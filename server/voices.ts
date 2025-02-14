import OpenAI from "openai";
import * as fs from "fs";


async function build() {
    const client = new OpenAI({ apiKey: ""})
    const mp3 = await client.audio.speech.create({
        model: 'tts-1-hd',
        voice: 'alloy',
        input: 'test 1 2 3'
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.promises.writeFile('./output.mp3', buffer);
}
