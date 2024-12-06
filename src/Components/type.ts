export type LngLatBound = {
    lat1: number;
    lat2: number;
    lng1: number;
    lng2: number;
}

export type SimRaw = {
    name: string;
    start: number;
    steps: number;
    min_lng: number;
    max_lng: number;
    min_lat: number;
    max_lat: number;
}
