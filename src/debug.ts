import {GameConfig} from "./gameConfig";

const config =  GameConfig.getInstance();

export default function debugLog(...params: any[]) {
    if (config.debug) {
        console.log(...params);
    }
}