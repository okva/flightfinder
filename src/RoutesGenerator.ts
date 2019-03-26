import csv from 'csv-parser';
import * as fs from 'fs';
import {GenAirport} from './AirportsGenerator';

export interface GenRoute {
    from: string;
    to: string;
    fromNum: number;
    toNum: number;
    distance: number;
}

interface CalRoute {
    from: number;
    to: number;
    distance: number;
}

export class RoutesGenerator {

    public static calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R: number = 6371e3; // metres
        const f1 = this.toRadians(lat1);
        const f2 = this.toRadians(lat2);
        const df = this.toRadians(lat2 - lat1);
        const da = this.toRadians(lon2 - lon1);

        const a: number = Math.sin(df / 2) * Math.sin(df / 2) +
            Math.cos(f1) * Math.cos(f2) *
            Math.sin(da / 2) * Math.sin(da / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return Math.round(R * c / 1000);
    }

    public static calcDistAir(fromNum: number, toNum: number, airports: GenAirport[]): number {
        if (fromNum === undefined || toNum === undefined) {
            return 0xFFFF;
        }
        const dist = this.calcDistance(airports[fromNum].latitude, airports[fromNum].longitude,
                                        airports[toNum].latitude, airports[toNum].longitude );
        return dist;
    }

    private static toRadians(degrees: number) {
        const pi = Math.PI;
        return degrees * (pi / 180);
    }

    // Create map from airport code to internal number
    private static getAirportsMap(airports: GenAirport[]): Map<string, number> {
        const map: Map<string, number> = new Map();
        for (let i = 0; i < airports.length; i++) {
            map.set(airports[i].iata, i);
            map.set(airports[i].icao, i);
        }
        return map;
    }

    private routes: Map<string, GenRoute> = new Map();

    public getRoutes(): Map<string, GenRoute> {
        return this.routes;
    }

    public async read(filename: string) {
        const label = 'read routes';
        console.time(label);
        const promise = new Promise((resolve) => {
            fs.createReadStream(filename)
                .pipe(csv(['h1', 'h2', 'from', 'h4', 'to', 'h6', 'h7', 'h8', 'h9']))
                .on('data', (data: {h1: string, h2: string, from: string, h4: string, to: string,
                    h6: string, h7: string, h8: string, h9: string}) => {
                    const from = data.from;
                    const to = data.to;
                    const genRoute: GenRoute = {from, to, distance: 0xFFFF, fromNum: 0XFFFF, toNum: 0xFFFF};
                    this.routes.set(from + '-' + to, genRoute);
                })
                .on('end', () => {
                    console.log(`Data has been read ${this.routes.size}`);
                    console.timeEnd(label);
                    resolve();
                });
        });
        await promise;
    }

    // calculate all distances between airports which are connected
    public calcDistances(airports: GenAirport[]) {
        const label = 'calc distances';
        console.time(label);
        const airportsMap: Map<string, number> = RoutesGenerator.getAirportsMap(airports);
        let brokenCount = 0;
        this.routes.forEach((value) => {
                    const fromNum: number = airportsMap.get(value.from);
                    const toNum: number = airportsMap.get(value.to);
                    if (fromNum === undefined || toNum === undefined) {
                        // console.log('Airport missing - From:' + value.from +
                        // ', ' + fromNum + ' To:' + value.to + ', ' + toNum);
                        brokenCount++;
                    } else {
                        value.distance = RoutesGenerator.calcDistAir(fromNum, toNum, airports);
                        value.fromNum = fromNum;
                        value.toNum = toNum;
                    }
                },
            );

        console.log('Broken route count:' + brokenCount);
        console.timeEnd(label);
    }

    public async write(filename: string) {
        const writeStream = fs.createWriteStream(filename);
        let routesCount: number = 0;
        this.routes.forEach((value) => {
                if (value.distance !== 0xFFFF && value.fromNum !== 0xFFFF  && value.toNum !== 0xFFFF) {
                    writeStream.write( value.fromNum + ',' + value.toNum + ',' + value.distance + '\n');
                    routesCount++;
                }
            },
        );

        let promise: Promise<any>;
        promise = new Promise((resolve) => {
            writeStream.on('finish', () => {
                console.log('Wrote ' + routesCount + ' routes to file.');
                resolve();
            });
        });

        writeStream.end();

        await promise;
    }

}
