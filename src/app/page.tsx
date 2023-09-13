"use client";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import JSZip from 'jszip';

import { ReactElement, useEffect, useRef, useState } from "react";

export default function Home() {

    const [progress, setProgress] = useState(0);
    const [timeTaken, setTimeTaken] = useState(0);
    const [logMessages, setLogMessages] = useState<string[]>([]);
    const [uploadedFileName, setUploadedFileName] = useState("");
    const [inputTime, setInputTime] = useState("10");


    const [downloadLinks, setDownloadLinks] = useState<{
        filename: string;
        url: string;
    }[]>([]);

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

        if (time === undefined || speed === undefined) return;

        const timestamp = time.split(":").reverse()
            .map((el, index) => {
                const value = Number(el) * Math.pow(60, index);
                return value;
            })
            .reduce((acc, curent) => {
                return acc + curent;
            }, 0)

        setTimeTaken(timestamp / Number(speed));
    }

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (inputTime === "NaN") {
                setInputTime("10");
            }
            else if (Number(inputTime) < 10 || Number(inputTime) > 3600) {
                setInputTime("10");
            }
        }, 100);

        return () => {
            clearTimeout(timeoutId);
        }

    }, [inputTime])

    const formatTime = (seconds: number | string) => {
        const s = Number(seconds);

        const newSeconds = s % 60 < 10 ? `0${s % 60}` : `${s % 60}`;
        const newMinutes = `${Math.floor(s / 60) % 60 < 10 ? 0 : ""}${Math.floor(s / 60) % 60}`;
        const newHour = `${Math.floor(s / 3600) < 10 ? 0 : ""}${Math.floor(s / 3600)}`;

        return `${newHour}:${newMinutes}:${newSeconds}`
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

    const handleError = () => {
        alert("No file or input is not between 10s and 3600s");
    }

    const split = async () => {

        setDownloadLinks([]);
        if (!inputRef.current || !inputRef.current.files) {
            handleError
            return;
        }

        const file = inputRef.current.files[0];
        if (!file) {
            handleError();
            return;
        }

        const ffmpeg = ffmpegRef.current;

        await ffmpeg.writeFile(file.name, await fetchFile(file));

        const outputDir = 'output';

        const outputDirExists = (await ffmpeg.listDir('/')).filter((el) => el.name === outputDir);

        if (outputDirExists.length === 0) {
            await ffmpeg.createDir(outputDir);
        }

        await ffmpeg.exec(['-i', file.name, '-c:v', 'copy', '-c:a', 'copy', '-f', 'segment', '-segment_time', formatTime(inputTime), '-reset_timestamps', '1', '-map', '0', `${outputDir}/${file.name.split('.')[0]}-part-%d.mp4`]);

        const outputFiles = await ffmpeg.listDir(outputDir);

        const getUrl = async (file: { isDir: boolean, name: string }) => {
            if (file.isDir) return;

            const url = await ffmpeg.readFile(`${outputDir}/${file.name}`).then((fileData) => {
                return URL.createObjectURL(new Blob([(fileData as Uint8Array).buffer], { type: 'video/mp4' }));
            })
            return url;
        }

        outputFiles.map((file) => {
            getUrl(file)
                .then((url) => {
                    if (!file.isDir) ffmpeg.deleteFile(`${outputDir}/${file.name}`);
                    return url;
                })
                .then((url) => {
                    if (!url) return
                    const element = { filename: file.name, url };
                    return element;
                })
                .then((el) => {
                    if (el) setDownloadLinks((prev) => [...prev, el])
                })
        });
        setProgress(1);
        setTimeTaken(0);
    }

    const downloadZip = (downloadLinks: { filename: string, url: string }[]) => {
        const zip = new JSZip();
        const promises = downloadLinks.map((downloadLink) => {
            const promise = fetch(downloadLink.url)
                .then((response) => response.blob())
                .then((blob) => { zip.file(downloadLink.filename, blob) })
            return promise;
        });

        Promise.all(promises).then(() => {
            zip.generateAsync({ type: "blob" }).then((content) => {
                const url = window.URL.createObjectURL(content);
                const a = document.createElement("a");
                a.href = url;
                a.download = uploadedFileName.split('.')[0] + "-parts.zip";
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            });
        });
    }


    if (!loadedFFMPEG) {
        return <div className='flex justify-center items-center h-screen w-screen'> Loading... ~31Mb </div>
    }

    return (
        <>
            <div
                className='flex flex-col justify-center items-center min-h-screen gap-6'
            >

                <div className='text-left flex gap-1 flex-col m-4 p-1'>
                    <h1
                        className='font-medium text-3xl'
                    >
                        Video Splitter
                    </h1>
                    <p>A <span className='font-bold text-violet-500 '>easy way</span> to split videos. </p>
                </div>

                <div className="max-w-sm p-1 my-2">
                    <label
                        className="flex justify-center w-full h-32 px-4 transition border-2 border-white transition-color duration-500 border-dashed rounded-md appearance-none cursor-pointer hover:border-violet-500 focus:outline-none "
                    >
                        {
                            !uploadedFileName && (
                                <span className="flex items-center justify-center flex-col">
                                    <div className='flex items-center space-x-2'>
                                        <svg xmlns="http://www.w3.org/2000/svg"
                                            className="w-6 h-6" fill="none" viewBox="0 0 24 24"
                                            stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <span className="font-medium ">
                                            Drop files to attach, or <span className="text-violet-500 underline font-bold">browse</span>
                                        </span>
                                    </div>
                                    <div>
                                        <p
                                            className='text-xs'
                                        >
                                            Maxium 2Gb file.
                                        </p>
                                    </div>
                                </span>
                            )
                        }
                        {
                            uploadedFileName && (
                                <span
                                    className='flex items-center space-x-2'
                                >
                                    <p>{inputRef.current?.files?.[0].name}</p>
                                </span>
                            )
                        }


                        <input
                            ref={inputRef}
                            onChange={() => {
                                if (!inputRef.current) {
                                    setUploadedFileName("");
                                    return;
                                }

                                if (!inputRef.current.files) {
                                    setUploadedFileName("");
                                    return;
                                }

                                if (!inputRef.current.files[0]) {
                                    setUploadedFileName("");
                                    return;
                                }

                                setUploadedFileName(inputRef.current?.files[0].name)
                            }}
                            type="file"
                            name="file_upload"
                            className="hidden" />
                    </label>
                </div>
                <div className='flex flex-col items-center justify-center gap-1'>
                    <label>Segment length in seconds:</label>
                    <input
                        className='w-16 bg-[#0a0a0a] transition-color duration-500 text-violet-500 border-2 border-dashed border-white p-1 rounded-xl text-center focus:outline-none focus:border-violet-500'
                        type='number'
                        pattern='[0-9]+'
                        min={10}
                        max={3600}
                        value={inputTime}
                        onChange={(e) => {
                            setInputTime("" + Math.floor(e.target.valueAsNumber));
                        }}
                    />
                </div>
                <button
                    onClick={split}
                    className='text-xl p-2 border-2 border-dashed rounded-xl transition-color duration-500 hover:text-violet-500 hover:border-violet-500'
                >
                    Split!
                </button>

                <div className='flex sm:w-[512px] w-[256px] flex-col justify-center items-center'>
                    <div
                        className='bg-white w-full h-5 rounded-full text-center'
                    >
                        <div
                            className='bg-violet-500 h-full rounded-full shadow-sm shadow-violet-500'
                            style={{ width: `${progress * 100}%` }}
                        />
                    </div>

                    <p className='p-1 text-sm mt-1'>{(progress * 100).toFixed(2) + '%'}</p>
                    {/* <p>Time Remaning: {((((100 / (progress === 0 ? 1 : progress) * 100)) - 1) * timeTaken).toFixed(2) + 's'}</p> */}
                </div>

                {downloadLinks.length !== 0 && (
                    <div
                        className='flex flex-col p-2 border-violet-500 border rounded-lg w-5/6 mb-16'
                    >
                        <div
                            className='flex justify-center items-center p-4'
                        >
                            <button
                                className='p-2 text-lg text-violet-500 font-bold border-y border-violet-500 transition-all ease-in-out duration-300 rounded-lg'
                                onClick={(() => { downloadZip(downloadLinks) })}
                            >
                                Download All
                            </button>
                        </div>
                        <ul
                            className='grid grid-cols-2 sm:grid-cols-6 gap-6 p-4'
                        >
                            {downloadLinks.map((el, index) => {
                                return (
                                    <li
                                        className='p-2 rounded-lg border border-violet-500 text-xs truncate'
                                        key={index}>

                                        <a
                                            href={el.url}
                                            download={el.filename}
                                            className=''
                                        >
                                            {index}. {el.filename}
                                        </a>
                                    </li>
                                )
                            })}
                        </ul>

                    </div>
                )}


            </div >
        </>
    );
}

