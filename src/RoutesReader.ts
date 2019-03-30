import csv from 'csv-parser';
import * as fs from 'fs';
import {Utils} from './Utils';

export interface Route {
    from: number;
    to: number;
    distance: number;
}

export class RoutesReader {

    private routes: Route[] = [];
    private routesMap: Map<number, Uint32Array> = new Map();

    public getRoutes(): Route[] {
        return this.routes;
    }

    public getRoutesMap(): Map<number, Uint32Array> {
        return this.routesMap;
    }

    public async read(filename: string) {
        const label = 'Read generated routes';
        console.time(label);
        const promise = new Promise((resolve) => {
            fs.createReadStream(filename)
                .pipe(csv(['from', 'to', 'distance']))
                .on('data', (data: {from: string, to: string, distance: string}) => {
                    const from = parseInt(data.from, 10);
                    const to = parseInt(data.to, 10);
                    const distance = parseInt(data.distance, 10);
                    const route: Route = {from, to, distance};
                    this.routes.push(route);
                })
                .on('end', () => {
                    console.log(`Data has been read ${this.routes.length}`);
                    console.timeEnd(label);
                    resolve();
                });
        });
        await promise;
    }

    public createRoutesMap() {
        const label = 'Build routes map';
        console.time(label);
        this.routes.forEach((value) => {
            const oldDestinations = this.routesMap.get(value.from);
            // create 32bit uint where destination is 2 bytes and distance is 2 bytes
            const dest: number = Utils.merge(value.to, value.distance);
            if (oldDestinations === undefined) {
                this.routesMap.set(value.from, new Uint32Array([dest]));
            } else {
                // create new array with old length + 1 and copy old array to new
                const destinations = new Uint32Array(oldDestinations.length + 1);
                destinations.set(oldDestinations, 0);
                destinations[destinations.length - 1] = dest;
                this.routesMap.set(value.from, destinations);
            }
        });
        console.timeEnd(label);
    }

}
