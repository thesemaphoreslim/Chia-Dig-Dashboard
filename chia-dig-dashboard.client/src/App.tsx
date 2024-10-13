import { Buffer } from 'buffer';
import './App.css';
import React, { useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from 'react-responsive'
import { publicIpv4 } from 'public-ip';
import { bech32m } from 'bech32';
import * as CryptoJS from 'crypto-js';
import { useSearchParams } from 'react-router-dom';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import imgUrl from '/images/clipboard.png'

let myXCH: string = 'XCH Address';
let myPuzzleHash: string = '';
const mojo: number = .000000000001;
let myStoreID: string = '';

let myInterval: NodeJS.Timeout;
let myIntervalRunning: boolean = false;
let myStart: number = 0;
let myEnd: number = 10;
let allStart: number = 0;
let allEnd: number = 10;
let initialLoad: boolean = true;
let amisecure: boolean = true;
const genesisEpoch = Date.UTC(2024, 8, 3, 0, 0);
let startepoch: number = 0;
let endepoch: number = 0;
let epochSelection: string = 'All';
let myrecordSelection: number = 10;
let allrecordSelection: number = 10;
//const mobilemaxlength: number = 20;
let recordoptions: number[] = [10, 25, 50, 100];
interface apiResponse {
    coin_records: Records;
}
interface Records {
    coin_records?: {
        coin?: {
            parent_coin_info?: string;
            puzzle_hash?: string;
            amount?: number;
        };
        confirmed_block_index?: number;
        spent_block_index?: number;
        spent?: boolean;
        coinbase?: boolean;
        timestamp?: number;
    }[];
};

interface myDNS {
    Answer: {
        name: string;
        type: number;
        TTL: number;
        data: string;
    }[];
}

interface XCH {
    xch_address: string;
}

interface StoreData {
    key: number;
    data: StoreInfo;
}

interface StoreInfo {
    description: string;
    id: string;
    contentlength: string;
}
async function fetchXCH(xchurl: string): Promise<string> {
    let response: XCH;
    let fetcherror: boolean = false;
    console.log('My xchurl: ' + xchurl);
    try {
        response = await fetch(xchurl, {
            method: "GET"
        }
        ).then(response => response.json());
        return response.xch_address;
    } catch (error) {
        console.log('caught error in fetchXCH: ' + error)
        fetcherror = true;
    }
    if (fetcherror) {
        try {
            response = await fetch('https://dig.semaphoreslim.net/.well-known', {
                method: "GET"
            }
            ).then(response => response.json());
            return response.xch_address;
        } catch (error) {
            console.log('caught 2nd error in fetchXCH: ' + error);
            return 'XCH Address';
        }
    }
    return 'XCH Address';
}

async function fetchStores(): Promise<[StoreData[]]> {
    let hostname = window.location.hostname;

    if (hostname == 'localhost') {
        hostname = 'dig.semaphoreslim.net';
    }

    const dnsresponse: myDNS = await fetch('https://dns.google/resolve?name=' + hostname, {
        method: "GET"
    }).then(dnsresponse => dnsresponse.json());

    const dnsdata = dnsresponse.Answer;
    let useXCHAddress: boolean = false;
    let storeurl: string = '';
    const publicIP = await publicIpv4();

    if (Array.isArray(dnsdata)) {
        for (const dnsip of dnsdata) {
            if (publicIP == dnsip.data) {
                useXCHAddress = true;
            }
        }
    } else {
        console.log('No DNS records found for your hostname')
        hostname = publicIP;
    }

    if (publicIP == hostname)
    {
        storeurl = 'http://' + publicIP + ':4161';
        amisecure = false;
        useXCHAddress = true;
    }
    else
    {
        storeurl = 'https://' + hostname;
        amisecure = true;
    }

    if (useXCHAddress) {
        myXCH = await fetchXCH(storeurl + "/.well-known");
    }
    const dict: StoreData[] = [];
    try {
        const indexresponse = await fetch(storeurl);
        const indexdata = await indexresponse.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(indexdata, "text/html");
        const pees = Array.from(doc.querySelectorAll('p'));
        let n: number = 1;
        let id: string = '';
        let desc: string = '';
        let length: string = '';
        if (Array.isArray(pees)) {
            pees.map(pee => {
                if (pee.textContent != undefined) {
                    if (!desc) {
                        desc = pee.textContent?.trim();
                    } else if (!id) {
                        id = pee.textContent?.replace('Store ID:', '').trim();
                    } else if (!length) {
                        length = pee.textContent?.trim();
                    } else {
                        dict.push({ key: n, data: { description: desc, id: id, contentlength: length } })
                        desc = pee.textContent?.trim();
                        id = '';
                        length = '';
                        n++;
                    }
                } else {
                    console.log('textContent is undefined')
                }
            });
            if ((pees.length / 3) > dict.length) {
                dict.push({ key: n, data: { description: desc, id: id, contentlength: length } })
            }
        }
    } catch (error) {
        console.log('Error in html parser: ' + error);
    }
    return [dict];
}

async function fetchUsers(hint: string): Promise<apiResponse> {
    const response = await fetch('https://api.coinset.org/get_coin_records_by_hint', {
        method: 'POST',
        body: JSON.stringify({
            "hint": hint,
            "start_height": 0,
            "end_height": 0,
            "include_spent_coins": true
        })
    });
    const data: apiResponse = await response.json();
    return data;
}

//interface Props {
//    label: string;
//}

//function calculateEpochAndRound(): { epoch: number; round: number; } {
//    const firstEpochStart = new Date(Date.UTC(2024, 8, 3, 0, 0));

//    const currentTimestampMillis = new Date().getTime();

//    // Calculate the number of milliseconds in one epoch (7 days)
//    const millisecondsInEpoch = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

//    // Calculate the difference in milliseconds between the current timestamp and the first epoch start
//    const differenceMillis = currentTimestampMillis - firstEpochStart.getTime();

//    // Calculate the current epoch number
//    const epochNumber = Math.floor(differenceMillis / millisecondsInEpoch) + 1;

//    // Calculate the milliseconds elapsed since the start of the current epoch
//    const elapsedMillisInCurrentEpoch = differenceMillis % millisecondsInEpoch;

//    // Calculate the number of milliseconds in a round (10 minutes)
//    const millisecondsInRound = 10 * 60 * 1000; // 10 minutes in milliseconds

//    // Calculate the current round number
//    const roundNumber = Math.floor(elapsedMillisInCurrentEpoch / millisecondsInRound) + 1;

//    return { epoch: epochNumber, round: roundNumber };
//}

function setEpochStartandEnd(epoch: string) {
    // Calculate the number of milliseconds in one epoch (7 days)
    const millisecondsInEpoch = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    if (epoch == 'All') {
        startepoch = (genesisEpoch / 1000);
        endepoch = (new Date().getTime() / 1000);
    } else {
        startepoch = ((genesisEpoch + (millisecondsInEpoch * (Number(epoch.trim()) -1 ))) / 1000);
        endepoch = ((genesisEpoch + ((millisecondsInEpoch - 1) * Number(epoch.trim()))) / 1000);
    }
}

const StoreList: React.FC = () => {
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });

    const currentTimestampMillis = new Date().getTime();
    console.log('Rendering');
    setEpochStartandEnd(epochSelection);

    const firstEpochStart = new Date(Date.UTC(2024, 8, 3, 0, 0));

    // Calculate the number of milliseconds in one epoch (7 days)
    const millisecondsInEpoch = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    // Calculate the difference in milliseconds between the current timestamp and the first epoch start
    let differenceMillis = currentTimestampMillis - firstEpochStart.getTime();
    let n: number = 1
    const epochs: number[] = [];
    const strepochs: string[] = [];
    if (differenceMillis > millisecondsInEpoch) {
        epochs.push(n);
    }
    do {
        differenceMillis = differenceMillis - millisecondsInEpoch;
        n++;
        epochs.push(n);
    } while (differenceMillis > millisecondsInEpoch)
    strepochs.push('All');
    for (const epoch of epochs.sort((a, b) => b - a)) {
        strepochs.push(epoch.toString());
    }

    //const [value, setValue] = useState('');
    //label = 'XCH Address: ';

    const [searchParams] = useSearchParams();

    const deepStoreID = searchParams.get('storeid');

    const HandleNext = useCallback(() => {
        allStart = allStart + allrecordSelection;
        allEnd = allEnd + allrecordSelection;
        setData((prevstate) => ({ ...prevstate, loading: false }));
    }, []);

    const HandlePrev = useCallback(() => {
        if (myrecordSelection > allStart) {
            allStart = 0;
            allEnd = myrecordSelection
        } else {
            allStart = allStart - myrecordSelection;
            allEnd = allEnd - myrecordSelection;
        }
        setData((prevstate) => ({ ...prevstate, loading: false }));
    }, []);

    const YourHandleNext = useCallback(() => {
        myStart = myStart + myrecordSelection;
        myEnd = myEnd + myrecordSelection;
        setData((prevstate) => ({ ...prevstate, loading: false }));
    }, []);

    const YourHandlePrev = useCallback(() => {
        if (myrecordSelection > myStart) {
            myStart = 0;
            myEnd = myrecordSelection
        } else {
            myStart = myStart - myrecordSelection;
            myEnd = myEnd - myrecordSelection;
        }
        setData((prevstate) => ({ ...prevstate, loading: false }));
    }, []);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.value == '') {
            myXCH = '';
            myPuzzleHash = '';
        } else {
            myXCH = event.target.value;
            myPuzzleHash = addresstoPuzzleHash(myXCH);
        }
        if (myStoreID.length > 0) {
            HandleClick(myStoreID, false, false, true);
        } else {
            setData((prevstate) => ({ ...prevstate, loading: false }));
        }
    }

    const handleEpochChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = event.target.value;
        if (epochSelection == selectedValue) {
            return;
        }
        epochSelection = selectedValue;
        setEpochStartandEnd(epochSelection);
        if (myStoreID.length > 0) {
            setData((prevstate) => ({ ...prevstate, loading: true }));
            HandleClick(myStoreID, true, true, false);
        }
    }

    const handleAllRecordChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = Number(event.target.value);
        if (allrecordSelection == selectedValue) {
            return;
        }
        let recorddiff = 0;
        if (allrecordSelection > selectedValue) {
            recorddiff = allrecordSelection - selectedValue;
            allEnd = allEnd - recorddiff;
        } else {
            recorddiff = selectedValue - allrecordSelection;
            allEnd = allEnd + recorddiff;
        }
        allrecordSelection = selectedValue;
        setData((prevstate) => ({ ...prevstate, loading: false }));
    }

    const handleMyRecordChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = Number(event.target.value);
        if (myrecordSelection == selectedValue) {
            return;
        }
        let recorddiff = 0;
        if (myrecordSelection > selectedValue) {
            recorddiff = myrecordSelection - selectedValue;
            myEnd = myEnd - recorddiff;
        } else {
            recorddiff = selectedValue - myrecordSelection;
            myEnd = myEnd + recorddiff;
        }
        myrecordSelection = selectedValue;
        setData((prevstate) => ({ ...prevstate, loading: false }));
    }

    const blankRecords: Records = {};
    
    const [data, setData] = useState({
        sum: 0,
        mysum: 0,
        users: blankRecords,
        loading: false,
    });

    const HandleClick = useCallback((storeId: string, isTimer: boolean, sumsonly: boolean, forceupdate: boolean) => {
        if (!storeId) {
            return;
        }
        if (storeId == myStoreID && !initialLoad && !sumsonly && !forceupdate) {
            myStoreID = '';
            clearInterval(myInterval);
            console.log('Cleared interval');
            myIntervalRunning = false;
            setData({ users: {}, sum: 0, mysum: 0, loading: false })
            return;
        }
        async function getHint() {
            if (!isTimer && !sumsonly) {
                setData({ users: {}, sum: 0, mysum: 0, loading: true });
            }
            const blankResponse: apiResponse = {} as apiResponse;
            let mydata: apiResponse = blankResponse;
            if (!sumsonly && !forceupdate) {
                const storearray: Buffer = Buffer.from(storeId, 'hex');
                if (!Buffer.isBuffer(storearray) || storearray.length !== 32) {
                    throw new Error("Invalid input. Must be a 32-byte buffer.");
                }
                const seed = "digpayment";
                const combinedBuffer = Buffer.concat([Buffer.from(seed), storearray]);

                let hashHex: string = '';
                try {
                    if (!amisecure) {
                        const test = combinedBuffer.buffer;
                        hashHex = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(test)).toString(CryptoJS.enc.Hex);
                    } else {
                        const hashBuffer = await window.crypto.subtle.digest('SHA-256', combinedBuffer);
                        const hashArray = Array.from(new Uint8Array(hashBuffer));
                        hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                    }
                }
                catch (err) {
                    console.log('Error in gethint: ' + (err as Error).message);
                }
                mydata = await fetchUsers(hashHex);
            } else {
                mydata.coin_records = data.users;
            }
            let tempsum = 0;
            let tempmysum = 0;
            if (Array.isArray(mydata.coin_records)) {
                let total = mydata.coin_records.filter(addy => addy.timestamp >= startepoch && addy.timestamp <= endepoch).reduce((acc, item) => {
                    if (typeof item.coin?.amount == 'number' && !isNaN(item.coin?.amount)) {
                        return acc + item.coin?.amount;
                    }
                    else {
                        return 0;
                    }
                }, 0);
                tempsum = (total * mojo)
                if (myPuzzleHash) {
                    total = mydata.coin_records.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash && addy.timestamp >= startepoch && addy.timestamp <= endepoch).reduce((acc, item) => {
                        if (typeof item.coin?.amount == 'number' && !isNaN(item.coin?.amount)) {
                            return acc + item.coin?.amount;
                        }
                        else {
                            return 0;
                        }
                    }, 0);
                    tempmysum = (total * mojo);
                } else {
                    tempmysum = 0;
                }
                setData({ users: mydata.coin_records, sum: tempsum, mysum: tempmysum, loading: false })
            }
        }

        if (!myIntervalRunning) {
            console.log('Assigned Interval');
            myInterval = setInterval(() => {
                if (myStoreID) {
                    console.log('Interval met for ' + myStoreID);
                    const tempid = myStoreID;
                    myStoreID = '';
                    HandleClick(tempid, true, false, false);
                }
            }, 300000);
            myIntervalRunning = true;
        }

        if (isTimer || myStoreID != storeId || sumsonly || forceupdate) {
            console.log('Running getHint');
            myStoreID = storeId;
            getHint();
        }
        else {
            console.log('Disabling interval');
            clearInterval(myInterval);
            myIntervalRunning = false;
            myStoreID = '';
            setData({ users: {}, sum: 0, mysum: 0, loading: false });
        }
    }, [data.users]);


    const blank: StoreData[] = []
    const [test, setTest] = useState({
        loading: false,
        users: blank,
    });

    useEffect(() => {
        async function fetchData() {
            const blank: StoreData[] = [];
            try {
                setTest({ loading: true, users: blank })
                const [dict] = await fetchStores();
                setTest({ loading: false, users: dict });
            } catch (error) {
                console.log('Error in fetchData: ' + error);
            }
        }
        fetchData();
    }, []);

    if (myXCH != 'XCH Address' && myXCH.length > 0) {
        myPuzzleHash = addresstoPuzzleHash(myXCH);
    }

    if (isMobile && initialLoad) {
        recordoptions = [5, 10, 25, 50, 100];
        myrecordSelection = 5;
        allrecordSelection = 5;
        myEnd = 5;
        allEnd = 5;
    }

    if (deepStoreID && initialLoad) {
        myStoreID = deepStoreID;
        setData((prevstate) => ({ ...prevstate, loading: true }));
        HandleClick(deepStoreID, true, false, false);
        initialLoad = false;
    }

    function truncForMobile(str: string, maxsize: number) {
        if (str.length > maxsize) {
            if (str.length > (maxsize * 2)) {
                return (str.substring(0, maxsize) + '...' + str.substring(str.length - maxsize));
            } else {
                return (str.substring(0, maxsize)) + '...';
            }
        } else {
            return str;
        }
    }

    initialLoad = false;

    if (test.loading) {
        return <p>Loading stores...</p>
    } else if (test.users?.length) {
        return (
            <div>
                {isMobile ? (
                    <div>
                        <br />
                        <table align="center" width="100%">
                            <tbody>
                                <tr>
                                    <td align="center">
                                        Enter your DIG Node XCH address in the space provided<br />then click a store ID to view incentive payouts for the store
                                        <br /><br />
                                        <input type="text" id='XCH_Address' value={(myXCH == 'XCH Address' || '' ? '' : myXCH)} placeholder={myXCH} onChange={handleChange} style={{ width: '100%' }} />
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <br />
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center">
                                        <table border={1} align="center">
                                            <tbody>
                                                <tr>
                                                    <td align="center" style={{ padding: '5px' }}>
                                                        <b>Description</b>
                                                    </td>
                                                    <td align="center" style={{ padding: '5px' }}>
                                                        <b>Store ID</b>
                                                    </td>
                                                    <td align="center" style={{ padding: '5px' }}>
                                                        <b>App Size</b>
                                                    </td>
                                                </tr>
                                                {test.users.map((store, i) => (
                                                    <tr key={i}>
                                                        <td align="center" style={{ padding: '5px' }}>
                                                            {truncForMobile(store.data.description, 25)}
                                                        </td>
                                                        <td align="center" style={{ padding: '5px' }}>
                                                            <a onClick={() => HandleClick(store.data.id, false, false, false)} key={store.data.id} style={{ cursor: 'pointer' }}>{truncForMobile(store.data.id, 5)}</a>&nbsp;&nbsp;
                                                            <CopyToClipboard text={store.data.id}>
                                                                <a style={{ cursor: 'pointer' }} ><img width="15" height="15" src={imgUrl} /></a>
                                                            </CopyToClipboard>
                                                        </td>
                                                        <td align="center" style={{ padding: '5px' }}>
                                                            {truncForMobile(store.data.contentlength, 10)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {Array.isArray(data.users) && !data.loading ? (
                            <div>
                            <br/>
                                <section>
                                    <table align="center" width="100%">
                                        <tbody>
                                            <tr>
                                                <td align="center">
                                                    Last Updated: {new Date().toLocaleString()}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center">
                                                    <b>Store ID: {truncForMobile(myStoreID, 5)}</b>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table align="right" width="100%">
                                        <tbody>
                                            <tr>
                                                <td align="right">
                                                    Selected Epoch(s):&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                                    <select onChange={handleEpochChange}>
                                                        {strepochs.map((epoch) => (
                                                            <option key={epoch} value={epoch}>
                                                                {epoch}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table id="records" border={1} width="100%" align="center">
                                        <tbody>
                                            <tr>
                                                <td width="100%">
                                                    <h2 key={myStoreID}>Your Payments<br />({Array.isArray(data.users) ? data.mysum : 0})</h2>
                                                    <table border={1} align="center">
                                                        <tbody>
                                                            <tr key='amount'>
                                                                <td style={{ padding: '5px' }}>Amount</td>
                                                                <td style={{ padding: '5px' }}>Address</td>
                                                                <td style={{ padding: '5px' }}>Confirmed at</td>
                                                            </tr>
                                                            {myPuzzleHash && data.users.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash && addy.timestamp >= startepoch && addy.timestamp <= endepoch).sort((a, b) => b.timestamp - a.timestamp).slice(myStart, myEnd).map((store, i) => (
                                                                <tr key={i}>
                                                                    <td style={{ padding: '5px' }}>{(store.coin?.amount * .000000000001).toFixed(8)}</td>
                                                                    <td style={{ padding: '5px' }}><a onClick={() => NewTab(store.coin?.puzzle_hash)} style={{ cursor: 'pointer' }}>{truncForMobile(puzzleHashToAddress(store.coin?.puzzle_hash), 5)}</a>&nbsp;&nbsp;
                                                                        <CopyToClipboard text={puzzleHashToAddress(store.coin?.puzzle_hash)}>
                                                                            <a style={{ cursor: 'pointer' }} >
                                                                                <img width="15" height="15" src={imgUrl} />
                                                                            </a>
                                                                        </CopyToClipboard>
                                                                    </td>
                                                                    <td style={{ padding: '5px' }}>{(new Date(store.timestamp * 1000)).toLocaleString()}</td>
                                                                </tr>
                                                            ))}
                                                            <tr key='next'>
                                                                <td>
                                                                    <button onClick={() => YourHandlePrev()} disabled={myStart <= 0}>Prev</button>
                                                                </td>
                                                                <td>
                                                                    <select onChange={handleMyRecordChange}>
                                                                        {recordoptions.map((records) => (
                                                                            <option key={records} value={records}>
                                                                                {records}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                                <td>
                                                                    <button onClick={() => YourHandleNext()} disabled={data.users.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash).length <= myEnd}>Next</button>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td width="100%">
                                                    <h2 key={myStoreID}>All Payments<br/>({Array.isArray(data.users) ? data.sum : 0})</h2>
                                                    <table border={1} align="center">
                                                        <tbody>
                                                            <tr key='amount'>
                                                                <td style={{ padding: '5px' }}>Amount</td>
                                                                <td style={{ padding: '5px' }}>Address</td>
                                                                <td style={{ padding: '5px' }}>Confirmed at</td>
                                                            </tr>
                                                            {data.users.filter(addy => addy.timestamp >= startepoch && addy.timestamp <= endepoch).sort((a, b) => b.timestamp - a.timestamp).slice(allStart, allEnd).map((store, i) => (
                                                                <tr key={i}>
                                                                    <td style={{ padding: '5px' }}>{((store.coin?.amount) * mojo).toFixed(8)}</td>
                                                                    <td style={{ padding: '5px' }}><a onClick={() => NewTab(store.coin?.puzzle_hash)} style={{ cursor: 'pointer' }}>{truncForMobile(puzzleHashToAddress(store.coin?.puzzle_hash), 5)}</a>&nbsp;&nbsp;
                                                                        <CopyToClipboard text={puzzleHashToAddress(store.coin?.puzzle_hash)}>
                                                                            <a style={{ cursor: 'pointer' }} >
                                                                                <img width="15" height="15" src={imgUrl} />
                                                                            </a>
                                                                        </CopyToClipboard>
                                                                    </td>
                                                                    <td style={{ padding: '5px' }}>{(new Date(store.timestamp * 1000)).toLocaleString()}</td>
                                                                </tr>
                                                            ))}
                                                            <tr key='next'>
                                                                <td>
                                                                    <button onClick={() => HandlePrev()} disabled={allStart <= 0}>Prev</button>
                                                                </td>
                                                                <td>
                                                                    <select onChange={handleAllRecordChange}>
                                                                        {recordoptions.map((records) => (
                                                                            <option key={records} value={records}>
                                                                                {records}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                                <td>
                                                                    <button onClick={() => HandleNext()} disabled={data.users.length <= allEnd}>Next</button>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </section>
                            </div>
                        ) : data.loading && (<p>Loading records...</p>)}
                    </div>
                ) : (
                <div>
                    <br /><br />
                    <table width="100%">
                        <tbody>
                            <tr>
                                <td align="center">
                                    Enter your DIG Node XCH address in the space provided<br />then click a store ID to view incentive payouts for the store
                                    <br /><br />
                                    <input type="text" id='XCH_Address' value={(myXCH == 'XCH Address' ? '' : myXCH)} placeholder={myXCH} onChange={handleChange} style={{ width: '450px' }} />
                                </td>
                                <td align="center">
                                    <table border={1} align="center">
                                        <tbody>
                                            <tr>
                                                <td align="center">
                                                    <b>Description</b>
                                                </td>
                                                <td align="center">
                                                    <b>Store ID</b>
                                                </td>
                                                <td align="center">
                                                    <b>App Size</b>
                                                </td>
                                            </tr>
                                            {test.users.map((store, i) => (
                                                <tr key={i}>
                                                    <td align="center" style={{ padding: '10px' }}>
                                                        {store.data.description}
                                                    </td>
                                                    <td align="center" style={{ padding: '10px' }}>
                                                        <a onClick={() => HandleClick(store.data.id, false, false, false)} key={store.data.id} style={{ cursor: 'pointer' }}>{store.data.id}</a>&nbsp;&nbsp;
                                                        <CopyToClipboard text={store.data.id}>
                                                            <a style={{ cursor: 'pointer' }} >
                                                                <img width="15" height="15" src={imgUrl} />
                                                            </a>
                                                        </CopyToClipboard>
                                                    </td>
                                                    <td align="center" style={{ padding: '10px' }}>
                                                        {store.data.contentlength}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    {Array.isArray(data.users) && !data.loading ? (
                        <div>
                            <section>
                                <br />
                                <table align="center" width="100%">
                                    <tbody>
                                        <tr>
                                            <td align="center">
                                                <p>Last Updated: {new Date().toLocaleString()}</p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td align="center">
                                                <p><b>Store ID: {myStoreID}</b></p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table align="right" width="100%">
                                    <tbody>
                                        <tr>
                                            <td align="right">
                                                Selected Epoch(s):&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                                <select onChange={handleEpochChange}>
                                                    {strepochs.map((epoch) => (
                                                        <option key={epoch} value={epoch}>
                                                            {epoch}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table id="records" border={1} width="100%" align="center">
                                    <tbody>
                                        <tr>
                                            <td width="50%">
                                                <h2 key={myStoreID}>All Payments ({Array.isArray(data.users) ? data.sum : 0})</h2>
                                                <table border={1} align="center">
                                                    <tbody>
                                                        <tr key='amount'>
                                                            <td style={{ padding: '5px' }}>Amount</td>
                                                            <td style={{ padding: '5px' }}>Address</td>
                                                            <td style={{ padding: '5px' }}>Confirmed at</td>
                                                        </tr>
                                                        {data.users.filter(addy => addy.timestamp >= startepoch && addy.timestamp <= endepoch).sort((a, b) => b.timestamp - a.timestamp).slice(allStart, allEnd).map((store, i) => (
                                                            <tr key={i}>
                                                                <td style={{ padding: '5px' }}>{((store.coin?.amount) * mojo).toFixed(8)}</td>
                                                                <td style={{ padding: '5px' }}><a onClick={() => NewTab(store.coin?.puzzle_hash)} style={{ cursor: 'pointer' }}>{puzzleHashToAddress(store.coin?.puzzle_hash)}</a>&nbsp;&nbsp;
                                                                    <CopyToClipboard text={puzzleHashToAddress(store.coin?.puzzle_hash)}>
                                                                        <a style={{ cursor: 'pointer' }} >
                                                                            <img width="15" height="15" src={imgUrl} />
                                                                        </a> 
                                                                    </CopyToClipboard>
                                                                </td>
                                                                <td style={{ padding: '5px' }}>{(new Date(store.timestamp * 1000)).toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                        <tr key='next'>
                                                            <td>
                                                                <button onClick={() => HandlePrev()} disabled={allStart <= 0}>Prev</button>
                                                            </td>
                                                            <td>
                                                                <select onChange={handleAllRecordChange}>
                                                                    {recordoptions.map((records) => (
                                                                        <option key={records} value={records}>
                                                                            {records}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td>
                                                                <button onClick={() => HandleNext()} disabled={data.users.length <= allEnd}>Next</button>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </td>
                                            <td width="50%">
                                                <h2 key={myStoreID}>Your Payments ({Array.isArray(data.users) ? data.mysum : 0})</h2>
                                                <table border={1} align="center">
                                                    <tbody>
                                                        <tr key='amount'>
                                                            <td style={{ padding: '5px' }}>Amount</td>
                                                            <td style={{ padding: '5px' }}>Address</td>
                                                            <td style={{ padding: '5px' }}>Confirmed at</td>
                                                        </tr>
                                                        {myPuzzleHash && data.users.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash && addy.timestamp >= startepoch && addy.timestamp <= endepoch).sort((a, b) => b.timestamp - a.timestamp).slice(myStart, myEnd).map((store, i) => (
                                                            <tr key={i}>
                                                                <td style={{ padding: '5px' }}>{(store.coin?.amount * .000000000001).toFixed(8)}</td>
                                                                <td style={{ padding: '5px' }}><a onClick={() => NewTab(store.coin?.puzzle_hash)} style={{ cursor: 'pointer' }}>{puzzleHashToAddress(store.coin?.puzzle_hash)}</a></td>
                                                                <td style={{ padding: '5px' }}>{(new Date(store.timestamp * 1000)).toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                        <tr key='next'>
                                                            <td>
                                                                <button onClick={() => YourHandlePrev()} disabled={myStart <= 0}>Prev</button>
                                                            </td>
                                                            <td>
                                                                <select onChange={handleMyRecordChange}>
                                                                    {recordoptions.map((records) => (
                                                                        <option key={records} value={records}>
                                                                            {records}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td>
                                                                <button onClick={() => YourHandleNext()} disabled={data.users.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash).length <= myEnd}>Next</button>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </section>
                        </div>
                    ) : data.loading && (<p>Loading records...</p>)}
                </div>
                )}
            </div>
        );
    }
}

function puzzleHashToAddress(puzzleHash: string): string {
    const puzzHash: Buffer = Buffer.from(validateHashString(puzzleHash), "hex");
    if (puzzHash.length !== 32) {
        return 'Invalid puzzlehash';
    }
    return bech32m.encode('xch', bech32m.toWords(puzzHash));
}

function addresstoPuzzleHash(address: string, maxLen?: number): string {
    try {
        return '0x' + Buffer.from(bech32m.fromWords(bech32m.decode(address, maxLen).words)).toString("hex");
    } catch (err) {
        console.log('Error converting address to puzzlehash: ' + err);
        return "";
    }
}

function validateHashString(puzzleHash: string): string {
    let ph: string = puzzleHash;
    if (ph.startsWith("0x"))
        ph = ph.slice(2, ph.length);

    if (ph.length !== 64 || !(new RegExp(/^[0-9A-Fa-f]+$/)).test(ph))
        return "";

    return ph;
}

function NewTab(puzzleHash: string) {
    const puzzHash: Buffer = Buffer.from(validateHashString(puzzleHash), "hex");
    if (puzzHash.length !== 32) {
        return 'Invalid puzzlehash';
    }
    window.open(("https://alltheblocks.net/chia/address/" + bech32m.encode('xch', bech32m.toWords(puzzHash))), "_blank");
}

export default StoreList;