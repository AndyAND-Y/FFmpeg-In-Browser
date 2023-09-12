"use client";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

import { ReactElement, useEffect, useRef, useState } from "react";

export default function Home() {

    const [progress, setProgress] = useState(0);
    const [timeTaken, setTimeTaken] = useState(0);
    const [splitSize, setSplitSize] = useState("1GB");
    const [logMessages, setLogMessages] = useState<string[]>([]);

    const [downloadLinks, setDownloadLinks] = useState<ReactElement[]>([]);

    const [loadedFFMPEG, setLoadedFFMPEG] = useState(false);
    const ffmpegRef = useRef(new FFmpeg());

    const inputRef = useRef<HTMLInputElement | null>(null);

    const handleProgressUpdate = ({ progress, time }: { progress: number, time: number }) => {
        setProgress(progress);
    }

    const handleLogMessage = ({ type, message }: { type: string, message: string }) => {
        setLogMessages((prev) => [...prev, message])

        const patternTime = /time=([\d:.]+)/
        const patternSpeed = /speed=([\d.]+)/

        const time = message.match(patternTime)?.[1];
        const speed = message.match(patternSpeed)?.[1];

        console.log("speed: ", Number(speed));
        console.log("time: ", time);

        if (time === undefined || speed === undefined) return;

        const timestamp = time.split(":").reverse()
            .map((el, index) => {
                console.log("el", el);
                const value = Number(el) * Math.pow(60, index);
                console.log("value: ", value);
                return value;
            })
            .reduce((acc, curent) => {
                return acc + curent;
            }, 0)

        console.log("ts: ", timestamp);

        setTimeTaken(timestamp / Number(speed));

    }


    useEffect(() => {

        const ffmpeg = ffmpegRef.current;
        ffmpeg.on('log', handleLogMessage);
        ffmpeg.on('progress', handleProgressUpdate);
        load();

        return () => {
            ffmpeg.off("log", handleLogMessage);
            ffmpeg.off("progress", handleProgressUpdate);
        }

    }, [])

    const load = async () => {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.2/dist/umd'
        const ffmpeg = ffmpegRef.current;
        // toBlobURL is used to bypass CORS issue, urls with the same
        // domain can be used directly.

        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        setLoadedFFMPEG(true);
    }

    const transcode = async () => {

        if (!inputRef.current || !inputRef.current.files) return;

        const file = inputRef.current.files[0];
        const filesLen = 0
        // file.size / (1024 * 1024 * 1024); "In Gb!";

        const ffmpeg = ffmpegRef.current;
        await ffmpeg.writeFile('input.mp4', await fetchFile(file));
        // await ffmpeg.exec(['-i', 'input.mp4', '-c:v', 'copy', '-c:a', 'copy', '-f', 'segment', '-segment_time', splitSize, '-reset_timestamps', '1', '-map', '0', `output-part%d.mp4`]);
        await ffmpeg.exec(['-i', 'input.mp4', 'output-part-1.mp4']);
        const downloadLinks = [];

        for (let i = 1; i <= 1; ++i) {
            const outputFileName = `output-part-${i}.mp4`;

            const outputFile = await ffmpeg.readFile(outputFileName) as Uint8Array;
            const url = URL.createObjectURL(new Blob([outputFile.buffer], { type: 'video/mp4' }));

            const element: ReactElement = (<a href={url} download={outputFileName}>
                {outputFileName}
            </a>)

            downloadLinks.push(element);

        }
        console.log(downloadLinks);
        setDownloadLinks([...downloadLinks]);
    }

    if (!loadedFFMPEG) {
        return <div> Loading... ~31Mb </div>
    }

    return (
        <>
            <div
                className='flex flex-col justify-center items-center'
            >
                <input ref={inputRef} type="file" />
                <button onClick={transcode}>Compute!</button>

                <div className='h-24 overflow-y-auto p-1 border w-1/2'>
                    {logMessages.map((message, index) => {
                        return <p key={index}> {message} </p>
                    })}
                </div>

                <div>
                    <p>Time Taken: {timeTaken.toFixed(2) + 's'}</p>
                    <p>Time Remaning: {((100 / (progress * 100) - 1) * timeTaken).toFixed(2) + 's'}</p>
                    <p>Progress: {(progress * 100).toFixed(2) + '%'}</p>
                </div>

                <div>
                    {downloadLinks}
                </div>

            </div>
        </>
    );
}

