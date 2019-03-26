import {AirportsGenerator} from './AirportsGenerator';
import {RoutesGenerator} from './RoutesGenerator';

const airports: AirportsGenerator = new AirportsGenerator();
const routes: RoutesGenerator = new RoutesGenerator();

function generateFiles() {
    const label = 'Generate total time';
    console.time(label);

    const p: [Promise<void>, Promise<void>] = [
        airports.read('./resources/airports.dat'),
        routes.read('./resources/routes.dat'),
    ];

    Promise.all(p).then(() => {
        airports.write('./resources/airports_generated.csv');
        routes.calcDistances(airports.getAirports());
        routes.write('./resources/routes_generated.csv').then(() => {
            console.timeEnd(label);
        });
    });

}

generateFiles();
