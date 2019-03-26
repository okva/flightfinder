import { expect } from 'chai';
import 'mocha';
import {AirportsReader} from './AirportsReader';
import {RoutesCalculator} from './RoutesCalculator';
import {RoutesReader} from './RoutesReader';

describe('Read airports with reader', () => {

    it('should match airport [1]', () => {
        const airports: AirportsReader = new AirportsReader();
        return airports.read('./resources/airports_generated.csv')
            .then(() => {
                expect(airports.getAirports().length).to.equal(7543);
                expect(airports.getAirports()[1].index).to.equal(1);
                expect(airports.getAirports()[1].iata).to.equal('MAG');
                expect(airports.getAirports()[1].icao).to.equal('AYMD');
            });

    });

});

describe('Read routes with reader', () => {

    it('should match route [1]', () => {
        const routes: RoutesReader = new RoutesReader();
        return routes.read('./resources/routes_generated.csv')
            .then(() => {
                expect(routes.getRoutes().length).to.equal(36528);
                expect(routes.getRoutes()[1].from).to.equal(2810);
                expect(routes.getRoutes()[1].to).to.equal(2831);
                expect(routes.getRoutes()[1].distance).to.equal(1040);
            });

    });

});

describe('Test routes calculator', () => {

    it('should build routes', () => {
        const routes: RoutesReader = new RoutesReader();
        return routes.read('./resources/routes_generated.csv')
            .then(() => {
                expect(routes.getRoutes().length).to.equal(36528);
                routes.createRoutesMap();
                // 2810,2831,1040
                // 2810,2806,448
                expect(routes.getRoutesMap().get(2810).length).to.equal(7);
                expect(routes.getRoutesMap().get(2810)[0] >> 16).to.equal(2831);
                expect(routes.getRoutesMap().get(2810)[0] & 0xFFFF).to.equal(1040);
                expect(routes.getRoutesMap().get(2810)[1] >> 16).to.equal(2806);
                expect(routes.getRoutesMap().get(2810)[1] & 0xFFFF).to.equal(448);
            });

    });

});

describe('Test routes calculator for direct flight', () => {

    it('should calculate direct routes', () => {
        const routes: RoutesReader = new RoutesReader();
        return routes.read('./resources/routes_generated.csv')
            .then(() => {
                expect(routes.getRoutes().length).to.equal(36528);
                const rc: RoutesCalculator = new RoutesCalculator();
                routes.createRoutesMap();
                rc.setRoutes(routes);
                // 2810,2831,1040
                // 2810,2806,448
                let legs = rc.calculateRoute(2810, 2831);
                expect(legs.length).to.equal(1);
                expect(legs[0] >> 16).to.equal(2810);
                expect(legs[0] & 0xFFFF).to.equal(1040);
                legs = rc.calculateRoute(2810, 2806);
                expect(legs.length).to.equal(1);
                expect(legs[0] >> 16).to.equal(2810);
                expect(legs[0] & 0xFFFF).to.equal(448);
            });
    });

});

describe('Test routes calculator for complex flight', () => {

    it('should calculate routes', () => {
        const routes: RoutesReader = new RoutesReader();
        return routes.read('./resources/routes_generated.csv')
            .then(() => {
                expect(routes.getRoutes().length).to.equal(36528);
                const rc: RoutesCalculator = new RoutesCalculator();
                routes.createRoutesMap();
                rc.setRoutes(routes);
                // helsinki to houston
                let legs = rc.calculateRoute(417, 3365, 5);
                expect(legs.length).to.equal(5);
                // distance
                expect(legs[4] & 0xFFFF).to.equal(8707);
                // last airport visited
                expect(legs[4] >> 16).to.equal(3273);

                legs = rc.calculateRoute(417, 3365, 4);
                expect(legs.length).to.equal(5);
                // distance
                expect(legs[4] & 0xFFFF).to.equal(8707);
                // last airport visited
                expect(legs[4] >> 16).to.equal(3273);

                legs = rc.calculateRoute(417, 3365, 3);
                expect(legs.length).to.equal(4);
                expect(legs[3] & 0xFFFF).to.equal(8709);
                expect(legs[3] >> 16).to.equal(3384);

                legs = rc.calculateRoute(417, 3365, 2);
                expect(legs.length).to.equal(3);
                expect(legs[2] & 0xFFFF).to.equal(8890);
                expect(legs[2] >> 16).to.equal(3294);

                legs = rc.calculateRoute(417, 3365, 1);
                expect(legs.length).to.equal(2);
                expect(legs[1] & 0xFFFF).to.equal(8903);
                expect(legs[1] >> 16).to.equal(3596);

                // no direct flight
                legs = rc.calculateRoute(417, 3365, 0);
                expect(legs.length).to.equal(0);

                // LAX  - TAY
                legs = rc.calculateRoute(3284, 412, 1);
                expect(legs.length).to.equal(0);
            });
    });

});

describe('Test average performance', () => {

    it('should calculate routes', () => {
        const routes: RoutesReader = new RoutesReader();
        return routes.read('./resources/routes_generated.csv')
            .then(() => {
                expect(routes.getRoutes().length).to.equal(36528);
                const rc: RoutesCalculator = new RoutesCalculator();
                routes.createRoutesMap();
                rc.setRoutes(routes);
                // helsinki to houston warmup
                let legs = rc.calculateRoute(417, 3365, 6);
                console.time('Route performance');
                const random = () => Math.floor(Math.random() * 7542);
                for (let i = 0; i < 1000; i++) {
                    legs = rc.calculateRoute(random(), random(), 6);
                }
                console.timeEnd('Route performance');
            });
    });

});
