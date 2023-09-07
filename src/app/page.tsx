"use client";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

import { useEffect, useRef, useState } from "react";

export default function Home() {
    const [loaded, setLoaded] = useState(false);
    const ffmpegRef = useRef(new FFmpeg());
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        load();
    }, [])

    const load = async () => {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.2/dist/umd'
        const ffmpeg = ffmpegRef.current;
        // toBlobURL is used to bypass CORS issue, urls with the same
        // domain can be used directly.

        ffmpeg.on('log', ({ type, message }: { type: string, message: string }) => {
            console.log(message);
        })

        ffmpeg.on('progress', ({ progress, time }: { progress: any, time: any }) => {
            console.log(progress, time);
        })

        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        setLoaded(true);
    }

    const transcode = async () => {

        if (!inputRef.current || !inputRef.current.files || !videoRef.current) return;

        const file = inputRef.current.files[0];

        const ffmpeg = ffmpegRef.current;
        await ffmpeg
            .writeFile(
                'input.webm',
                await fetchFile(file)
            );
        await ffmpeg.exec(['-i', 'input.webm', 'output.mp4']);
        const data = await ffmpeg.readFile('output.mp4');
        videoRef.current.src =
            URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
    }

    return (loaded
        ? (
            <>
                <video ref={videoRef} controls></video><br />
                <input ref={inputRef} type="file" />
                <button onClick={transcode}>Transcode webm to mp4</button>
                <p>Open Developer Tools (Ctrl+Shift+I) to View Logs</p>
            </>
        )
        : (
            <button onClick={load}>Load ffmpeg-core (~31 MB)</button>
        )
    );
}

