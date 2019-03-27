import {Request} from 'express-serve-static-core';
import {AirportsReader} from './AirportsReader';
import {RoutesReader} from './RoutesReader';

interface Flight {
    from: string;
    to: string;
    distance: number;
}

export class RoutesCalculator {

    private static MAX_STOPS = 3;
    /* Sacrifice readability to performance.
     RoutesMap is map where
     key is source airport index.
     Value is uint32 array where each uint represents:
     first two bytes is destination airport index,
     last two bytes is distance from source to destination.
     This is actually true for all places where uint32 array is used
     and in some other places. As we don't need more than 2 bytes for
     airport nor distance.
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
        // result contains full distance in each stop
        // for response report also leg distances
        const flightsArr: Flight[] = new Array();
        let totDistance: number = 0;
        for (let i = 0; i < results.length; i++) {
            const from: number = results[i] >> 16;
            const to: number = (i === results.length - 1) ? dest : results[i + 1] >> 16;
            const distance: number = (results[i] & 0xFFFF) - totDistance;
            totDistance = results[i] & 0xFFFF;
            const flight: Flight = {
                distance,
                from: this.airports.getAirportFromIndex(from),
                to: this.airports.getAirportFromIndex(to),
            };
            flightsArr.push(flight);
        }

        return {totalDistance: totDistance, flights: flightsArr};
    }

    public calculateRoute(from: number, to: number, maxStops: number = RoutesCalculator.MAX_STOPS): number[] {
        const label = 'Calculate route';
        console.time(label);

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

        const firstLegResult = this.calculateFirstLeg(from, to, maxStops);
        if (firstLegResult) {
            console.timeEnd(label);
            return firstLegResult;
        }

        // now we know that there is no direct flight
        // we have to search all routes to destination
        for (let stopIndex = 1; stopIndex < maxStops; stopIndex++) {
            this.calculateMiddleLeg(from, to, stopIndex);
        }

        // destination is two bytes airport index how we get there
        // and two bytes total distance
        const destination: number = this.calculateLastLeg(to);

        // if we have not reached to destination
        if (!(~destination)) {
            console.timeEnd(label);
            return [];
        }

        /* backtrack route
         if previous source airport is different
         then add stop
         in result we have all stops with distance to this stop
         */
        const result: number[] = [destination];
        for (let i = maxStops - 1; i >= 0; i--) {
            const previousAirport = result[0] >> 16;
            if (this.stops[i][previousAirport] >> 16 === result[0] >> 16) {
                continue;
            }
            result.unshift(this.stops[i][previousAirport]);
        }
        console.timeEnd(label);
        return result;
    }

    public setAirports(airports: AirportsReader) {
        this.airports = airports;
    }

    public setRoutes(routes: RoutesReader) {
        this.routesMap = routes.getRoutesMap();
    }

    private calculateFirstLeg(from: number, to: number, maxStops: number): number[] {
        // set distance to source airport to 0 and treat first leg specially
        const stop0 = this.stops[0];
        stop0[from] = (from << 16) | 0;
        const firstLegs = this.routesMap.get(from);
        if (firstLegs === undefined) {
            return [];
        }
        // for each destination set source airport and distance
        // two bytes source and two bytes distance
        const firstLegsLen = firstLegs.length;
        for (let i = 0; i < firstLegsLen; i++) {
            stop0[firstLegs[i] >> 16] = (from << 16) | (firstLegs[i] & 0xFFFF);
        }
        // if direct connection after first leg
        // then this should be the fastest route
        // reverse bits, if not 0 then we have reached destination
        if (~stop0[to]) {
            return [stop0[to]];
        }
        // only direct flights are wanted
        if (maxStops === 0) {
            return [];
        }
        return;
    }

    private calculateMiddleLeg(from: number, to: number, stopIndex: number) {
        // make copy of current stop
        const stop = this.stops[stopIndex - 1];
        const nextStop = stop.slice();
        this.stops[stopIndex] = nextStop;
        const prevStopInd = stopIndex - 2;
        // loop over all airports and see do we have reached there (stop)
        // if yes then try to go to next stop (nextStop)
        // i is airport index what we check
        for (let i = 0; i < stop.length; i++) {
            // reverse bits, if 0 then we have not reached into this airport
            if (!(~stop[i])) {
                continue;
            }
            // if nothing is changed from previous stop
            // then we already calculated destinations from this airport
            if (prevStopInd >= 0 && this.stops[prevStopInd][i] === stop[i]) {
                continue;
            }
            // current distance to this stop
            // add it later for next stop
            const currDist = stop[i] & 0xFFFF;
            const legs = this.routesMap.get(i);
            if (legs === undefined) {
                // No flights from stop i;
                continue;
            }
            // loop over flights from this airport
            for (const leg of legs) {
                // calculate total distance from source airport to
                // the end of current leg
                // then check total distance in the end of current flight
                // if total distance if too big (65535) then no need to go there
                // if total distance is smaller than we currently have then replace next stop
                // write new source airport and new distance
                const totDist = (leg & 0xFFFF) + currDist;
                if (totDist < 0xFFFF) {
                    if ((nextStop[leg >> 16] & 0xFFFF) > totDist) {
                        nextStop[leg >> 16] = (i << 16) | totDist;
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
            if (!(~stop[i])) {
                continue;
            }
            if (prevStopInd > 0 && this.stops[prevStopInd][i] === stop[i]) {
                continue;
            }
            // current distance to this stop
            // add it later for next stop
            const currDist = stop[i] & 0xFFFF;
            const legs = this.routesMap.get(i);
            if (legs === undefined) {
                // No flights from stop i;
                continue;
            }
            for (const leg of legs) {
                // calculate if we can get to destination
                if (leg >> 16 !== to) {
                    continue;
                }
                /* calculate total distance from source airport to
                 the destination airport
                 if needed write new source airport and new distance */
                const totDist = (leg & 0xFFFF) + currDist;
                if (totDist < 0xFFFF) {
                    if ((destination & 0xFFFF) > totDist) {
                        destination = (i << 16) | totDist;
                    }
                }
            }
        }
        return destination;
    }

}
