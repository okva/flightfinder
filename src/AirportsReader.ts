import csv from 'csv-parser';
import * as fs from 'fs';

export interface Airport {
    index: number;
    iata: string;
    icao: string;
}

export class AirportsReader {
    private airports: Airport[] = [];
    private airportsMap: Map<string, number>;

    public getAirports(): Airport[] {
        return this.airports;
    }

    public getAirportCount(): number {
        return this.airports.length;
    }

    public getAirportFromCode(code: string): number {
        if (code !== undefined) {
            code = code.toUpperCase();
        }
        if (code === '\\N') {
            return undefined;
        }
        return this.airportsMap.get(code);
    }

    public getAirportFromIndex(index: number): string {
        let code = this.airports[index].iata;
        if (code === '\\N') {
            code = this.airports[index].icao;
        }
        return code;
    }

    public async read(filename: string) {
        const label = 'Read generated airports';
        console.time(label);
        const promise = new Promise((resolve) => {
            fs.createReadStream(filename)
                .pipe(csv(['index', 'iata', 'icao']))
                .on('data', (data: {index: string, iata: string, icao: string}) => {
                    const index = parseInt(data.index, 10);
                    const iata = data.iata;
                    const icao = data.icao;
                    const airport: Airport = {index, iata, icao};
                    this.airports.push(airport);
                })
                .on('end', () => {
                    console.log(`Data has been read ${this.airports.length}`);
                    console.timeEnd(label);
                    resolve();
                });
        });
        await promise;
    }

    // Create map from airport code to internal number
    public createAirportsMap() {
        const map: Map<string, number> = new Map();
        for (const airport of this.airports) {
            map.set(airport.iata, airport.index);
            map.set(airport.icao, airport.index);
        }
        this.airportsMap = map;
    }
}
