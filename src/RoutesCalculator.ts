import {Request} from 'express-serve-static-core';
import {AirportsReader} from './AirportsReader';
import {RoutesReader} from './RoutesReader';
import {Utils} from './Utils';

interface Flight {
    from: string;
    to: string;
    distance: number;
}

export class RoutesCalculator {

    private static MAX_STOPS = 3;
    /*
     RoutesMap is map where
     key is source airport index.
     Value is uint32 array where each uint represents:
     first two bytes is destination airport index,
     last two bytes is distance from source to destination.
     This is actually true for all places where uint32 array is used.
     */
    private routesMap: Map<number, Uint32Array>;
    private stops: Uint32Array[];
    private airports: AirportsReader;

    public calculateRequest(req: Request): object {
        const sou = this.airports.getAirportFromCode(req.query.sou);
        const dest = this.airports.getAirportFromCode(req.query.dest);
        if (sou === undefined) {
            return {error: 'No source airport found: ' + req.query.sou};
        }
        if (dest === undefined) {
            return {error: 'No destination airport found: ' + req.query.dest};
        }
        if (sou === dest) {
            return {error: 'Source and destination are same.'};
        }
        let maxs = parseInt(req.query.maxs, 10);
        if (isNaN(maxs)) {
            maxs = RoutesCalculator.MAX_STOPS;
        }
        if (maxs < 0 || maxs > 99) {
            return {error: 'Yeah! Flight to mars?'};
        }

        console.log('Calculate s:' + sou + ' d:' + dest + ' max:' + maxs);

        let results: number[];
        try {
            results = this.calculateRoute(sou, dest, maxs);
        } catch (e) {
            return {error: e.message};
        }
        if (results.length === 0) {
            return {error: 'No flights found'};
        }

        const flightsArr: Flight[] = this.formatFlights(results, dest);
        const totDistance: number = Utils.extractDistance(results[results.length - 1]);

        return {totalDistance: totDistance, flights: flightsArr};
    }

    public calculateRoute(from: number, to: number, maxStops: number = RoutesCalculator.MAX_STOPS): number[] {
        const label = 'Calculate route';
        console.time(label);

        this.prepare(maxStops);

        const firstLegResult = this.calculateFirstLeg(from, to, maxStops);
        if (firstLegResult) {
            console.timeEnd(label);
            return firstLegResult;
        }

        // now we know that there is no direct flight
        // we have to search all routes to destination
        for (let stopIndex = 1; stopIndex < maxStops; stopIndex++) {
            this.calculateMiddleLeg(stopIndex);
        }

        // destination is two bytes airport index how we get there
        // and two bytes total distance
        const destination: number = this.calculateLastLeg(to);

        const result: number[] = this.backtrackRoute(destination, maxStops);

        console.timeEnd(label);
        return result;
    }

    public setAirports(airports: AirportsReader) {
        this.airports = airports;
    }

    public setRoutes(routes: RoutesReader) {
        this.routesMap = routes.getRoutesMap();
    }

    private prepare(maxStops: number) {
        /* create array of stops
         each stop contains all possible airports
         which are encoded into uint32 array as
         first two bytes is airport where from we came into this stop
         last two bytes is total distance to this stop
         */
        this.stops = new Array(maxStops);
        let airportCount = 7600;
        if (this.airports !== undefined) {
            airportCount = this.airports.getAirportCount();
        }
        // initialize airports array for first stop and fill with 1-s
        this.stops[0] = new Uint32Array(airportCount);
        this.stops[0].fill(0xFFFFFFFF);
    }

    private calculateFirstLeg(from: number, to: number, maxStops: number): number[] {
        // set distance to source airport to 0 and treat first leg specially
        const stop0 = this.stops[0];
        stop0[from] = Utils.merge(from, 0);
        const firstLegs = this.routesMap.get(from);
        if (firstLegs === undefined) {
            return [];
        }
        // for each reachable destination set source airport and distance
        for (const leg of firstLegs) {
            const toAirport = Utils.extractAirport(leg);
            const distance = Utils.extractDistance(leg);
            stop0[toAirport] = Utils.merge(from, distance);
            // if direct flight then search no more
            if (toAirport === to) {
                return [stop0[to]];
            }
        }
        // only direct flights are wanted
        if (maxStops === 0) {
            return [];
        }
        return;
    }

    private calculateMiddleLeg(stopIndex: number) {
        // make copy of current stop
        const stop = this.stops[stopIndex - 1];
        const nextStop = stop.slice();
        this.stops[stopIndex] = nextStop;
        const prevStopInd = stopIndex - 2;
        // loop over all airports and see do we have reached there (stop)
        // if yes then try to go to next stop (nextStop)
        // i is airport index what we check
        for (let i = 0; i < stop.length; i++) {
            if (!Utils.isReachable(stop[i])) {
                continue;
            }
            // if nothing is changed from previous stop
            // then we already calculated destinations from this airport
            if (prevStopInd >= 0 && this.stops[prevStopInd][i] === stop[i]) {
                continue;
            }
            const legs = this.routesMap.get(i);
            if (legs === undefined) {
                // No flights from stop i;
                continue;
            }
            // current distance to this stop, add it later for next stop
            const currDist = Utils.extractDistance(stop[i]);
            // loop over flights from this airport
            for (const leg of legs) {
                /* calculate total distance from source airport to
                 the end of current leg
                 then check total distance in the end of current flight
                 if total distance is too big, then no need to go there
                 if total distance is smaller than we currently have then replace next stop
                 write new source airport and new distance*/
                const totDist = Utils.extractDistance(leg) + currDist;
                if (totDist < Utils.MAX_DISTANCE) {
                    const toAirport = Utils.extractAirport(leg);
                    if ((Utils.extractDistance(nextStop[toAirport])) > totDist) {
                        nextStop[toAirport] = Utils.merge(i, totDist);
                    }
                }
            }
        }
    }

    private calculateLastLeg(to: number): number {
        // calculate last leg
        // no need to copy full stop map, only destination
        // which contains airport how we get there and distance
        const stop = this.stops[this.stops.length - 1];
        const prevStopInd = this.stops.length - 2;
        let destination = stop[to];

        for (let i = 0; i < stop.length; i++) {
            if (!Utils.isReachable(stop[i])) {
                continue;
            }
            // nothing is changed from previous stop
            if (prevStopInd > 0 && this.stops[prevStopInd][i] === stop[i]) {
                continue;
            }
            const legs = this.routesMap.get(i);
            if (legs === undefined) {
                // No flights from stop i;
                continue;
            }
            // current distance to this stop
            // add it later for next stop
            const currDist = Utils.extractDistance(stop[i]);
            for (const leg of legs) {
                // we only care about final destination
                if (Utils.extractAirport(leg) !== to) {
                    continue;
                }
                /* calculate total distance from source airport to
                 the destination airport
                 if needed write new source airport and new distance */
                const totDist = Utils.extractDistance(leg) + currDist;
                if (totDist < Utils.MAX_DISTANCE) {
                    if (Utils.extractDistance(destination) > totDist) {
                        destination = Utils.merge(i, totDist);
                    }
                }
            }
        }
        return destination;
    }

    private backtrackRoute(destination: number, maxStops: number): number[] {
        // if we have not reached to destination
        if (!Utils.isReachable(destination)) {
            return [];
        }
        // if previous source airport is different then add stop
        // in result we have all stops with distance to this stop
        const result: number[] = [destination];
        for (let i = maxStops - 1; i >= 0; i--) {
            const previousAirport = Utils.extractAirport(result[0]);
            if (Utils.extractAirport(this.stops[i][previousAirport]) === Utils.extractAirport(result[0])) {
                continue;
            }
            result.unshift(this.stops[i][previousAirport]);
        }
        return result;
    }

    private formatFlights(results: number[], dest: number): Flight[] {
        // result contains full distance in each stop
        // for response report also leg distances
        const flightsArr: Flight[] = new Array();
        let totDistance: number = 0;
        for (let i = 0; i < results.length; i++) {
            const from: number = Utils.extractAirport(results[i]);
            const to: number = (i === results.length - 1) ? dest : Utils.extractAirport(results[i + 1]);
            const distance: number = Utils.extractDistance(results[i]) - totDistance;
            totDistance = Utils.extractDistance(results[i]);
            const flight: Flight = {
                distance,
                from: this.airports.getAirportFromIndex(from),
                to: this.airports.getAirportFromIndex(to),
            };
            flightsArr.push(flight);
        }
        return flightsArr;
    }
}
