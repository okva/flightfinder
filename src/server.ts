import express from 'express';
import {AirportsReader} from './AirportsReader';
import {RoutesCalculator} from './RoutesCalculator';
import {RoutesReader} from './RoutesReader';

const app = express();
const airports: AirportsReader = new AirportsReader();
const routes: RoutesReader = new RoutesReader();

function serve() {
    const p: [Promise<void>, Promise<void>] = [
        airports.read('./resources/airports_generated.csv'),
        routes.read('./resources/routes_generated.csv'),
    ];

    Promise.all(p).then(() => {
        airports.createAirportsMap();
        routes.createRoutesMap();
        const rc: RoutesCalculator = new RoutesCalculator();
        rc.setAirports(airports);
        rc.setRoutes(routes);
        app.get('/', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(rc.calculateRequest(req)); });
        app.listen(3000, () => console.log('Route calculator listening on port 3000!'));
    });

}

serve();
