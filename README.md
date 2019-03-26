# flightfinder

> Shortest route finder for flights using tailored fast <b>Dijkstra</b> implementation in typescript.

Rest service for finding shortest route from one airport to another. It takes source (sou), destination (dest) and max stops (maxs) as parameters and calculates shortest distance based on these conditions.

## Airport and flights

This application uses airports and flight database taken from https://openflights.org/data.html. Airports and routes from this page are used to generate own files. Distances between airports are calculated using <b>Haversine formula</b>. During generation duplicate flights are removed, only connection between airports is important. Database contains 7543 airports and 36528 unique routes. With this limited set of data I got 1ms pure calculation speed with 6 stops.

## Dijkstra
For every stop we have full list of airports. Each airport has information about how we got there and total distance.
When we reach to the end, we can backtrack the fastest route.

![Diagram](https://github.com/okva/flightfinder/blob/master/dijdiagram.png)

## Scripts

* Install dependencies
```shell
npm install
```

* Build application 
```shell
npm run build-ts
```

* Generate .csv files. Files are already there so this can be skipped.
```shell
npm run generate
```

* Test  application. Currently tests are using production data, try to avoid changing it.
```shell
npm run test
```

* Start application.
```shell
npm run start
```

## Using service

Simple json over http service. For example following requests all return different routes. 

```
http://127.0.0.1:3000/?sou=HEL&dest=HOU&maxs=0
http://127.0.0.1:3000/?sou=HEL&dest=HOU&maxs=1
http://127.0.0.1:3000/?sou=HEL&dest=HOU&maxs=2
http://127.0.0.1:3000/?sou=HEL&dest=HOU&maxs=3
http://127.0.0.1:3000/?sou=HEL&dest=HOU&maxs=4
```
Example response:
```
{"totalDistance":8709,
  "flights":
  [
    {"distance":2444,"from":"HEL","to":"KEF"},
    {"distance":4171,"from":"KEF","to":"YYZ"},
    {"distance":707,"from":"YYZ","to":"IND"},
    {"distance":1387,"from":"IND","to":"HOU"}
  ]
}
```

