import { expect } from 'chai';
import 'mocha';
import {AirportsGenerator} from './AirportsGenerator';
import {RoutesGenerator} from './RoutesGenerator';

describe('Read airports with generator', () => {

    it('should match airport [1]', () => {
        const airports: AirportsGenerator = new AirportsGenerator();
        return airports.read('./resources/airports.dat')
            .then(() => {
                expect(airports.getAirports().length).to.equal(7543);
                expect(airports.getAirports()[1].iata).to.equal('MAG');
                expect(airports.getAirports()[1].icao).to.equal('AYMD');
            });

    });

});

describe('Read routes with generator', () => {

    it('should match routes', () => {
        const routes: RoutesGenerator = new RoutesGenerator();
        return routes.read('./resources/routes.dat')
            .then(() => {
                expect(routes.getRoutes().size).to.equal(37595);
                expect(routes.getRoutes().get('ASF-KZN').from).to.equal('ASF');
                expect(routes.getRoutes().get('ASF-KZN').to).to.equal('KZN');
                expect(routes.getRoutes().get('ASF-KZN').distance).to.equal(0xFFFF);
            });

    });

});

describe('Calc distances', () => {

    it('should calc distances', () => {
        const routes: RoutesGenerator = new RoutesGenerator();
        const airports: AirportsGenerator = new AirportsGenerator();

        const p: [Promise<void>, Promise<void>] = [
            airports.read('./resources/airports.dat'),
            routes.read('./resources/routes.dat'),
        ];
        return Promise.all(p)
                .then(() => {
                    routes.calcDistances(airports.getAirports());
                    expect(routes.getRoutes().size).to.equal(37595);
                    expect(routes.getRoutes().get('ASF-KZN').from).to.equal('ASF');
                    expect(routes.getRoutes().get('ASF-KZN').to).to.equal('KZN');
                    expect(routes.getRoutes().get('ASF-KZN').distance).to.equal(1040);
                });
    });

});

describe('Test distance calculator from coordinates', () => {
    it('from Helsinki to IAH houston', () => {
        const dist = RoutesGenerator
            .calcDistance(60.317199707031, 24.963300704956, 29.984399795532227, -95.34140014648438);
        expect(dist).to.equal(8609);
    });
});
