import csv from 'csv-parser';
import * as fs from 'fs';

export interface GenAirport {
    iata: string;
    icao: string;
    latitude: number;
    longitude: number;
}

export class AirportsGenerator {

    private airports: GenAirport[] = [];

    public getAirports(): GenAirport[] {
        return this.airports;
    }

    public async read(filename: string) {
        const label = 'read airports';
        console.time(label);
        const promise = new Promise((resolve) => {
            fs.createReadStream(filename)
                .pipe(csv(['num', 'ap', 'ci', 'co', 'iata', 'icao', 'latitude', 'longitude',
                    'h9', 'h10', 'h11', 'h12', 'h13', 'h14']))
                .on('data', (data: {num: string, ap: string, ci: string, co: string,
                        iata: string, icao: string, latitude: string, longitude: string,
                        h9: string, h10: string, h11: string, h12: string, h13: string, h14: string}) => {
                    const iata = data.iata;
                    const icao = data.icao;
                    const latitude = parseFloat(data.latitude);
                    const longitude = parseFloat(data.longitude);
                    const genAirport: GenAirport = {iata, icao, latitude, longitude};
                    this.airports.push(genAirport);
                    /*return this.airports.push({
                        from: fr, number: nr, to,
                    });*/
                })
                .on('end', () => {
                    console.log(`Data has been read ${this.airports.length}`);
                    console.timeEnd(label);
                    resolve();
                });
        });
        await promise;
    }

    public write(filename: string) {
        const writeStream = fs.createWriteStream(filename);

        for (let i = 0; i < this.airports.length; i++) {
            writeStream.write(i + ',' +  this.airports[i].iata + ',' + this.airports[i].icao + '\n');
        }

        writeStream.on('finish', () => {
            console.log('Wrote ' + this.airports.length + ' airports to file.');
        });

        writeStream.end();
    }

}
