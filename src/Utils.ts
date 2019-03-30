
export class Utils {

    public static MAX_DISTANCE = 0xFFFF;

    // distance is last two bytes of uint32
    public static extractDistance(uint32: number): number {
        return uint32 & 0xFFFF;
    }

    // airport is first two bytes of uint32
    public static extractAirport(uint32: number): number {
        return uint32 >> 16;
    }

    // combine airport index and distance into one uint32
    public static merge(airport: number, distance: number): number {
        return (airport << 16) | distance;
    }

    // check if this airport is reachable
    // combined number contains some airport
    // and distance bigger than 0
    // distance is 0 only for source airport
    public static isReachable(uint32: number) {
        return ~(uint32 >> 16) && (uint32 & 0xFFFF);
    }
}
