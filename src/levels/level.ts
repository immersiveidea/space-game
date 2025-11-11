import {Observable} from "@babylonjs/core";

export default interface Level {
    initialize(): void;
    dispose(): void;
    play(): void;
    getReadyObservable(): Observable<Level>;
}