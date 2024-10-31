/* eslint-disable react-hooks/exhaustive-deps */

import { Buffer } from 'buffer';
import './App.css';
import React, { useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from 'react-responsive'
import { publicIpv4 } from 'public-ip';
import { bech32m } from 'bech32';
import * as CryptoJS from 'crypto-js';
import { useSearchParams } from 'react-router-dom';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import localforage from 'localforage';
import imgUrl from '/images/clipboard.png'
import Tooltip from './Tooltip';

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
let recordoptions: number[] = [10, 25, 50, 100];
let storeurl: string = '';
let myBalance: string = 'NA';
let xchPrice: number = 0;
const xchCoinID: string = '9258';

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

interface PriceData {
    data: {
        [mysymbol: string]: {
            id: number;
            name: string;
            symbol: string;
            quote: {
                USD: {
                    price: number;
                    volume_24h: number;
                    percent_change_24h: number;
                };
            };
        };
    };
}
interface myDNS {
    Answer: {
        name: string;
        type: number;
        TTL: number;
        data: string;
    }[];
}

interface Balance {
    xch: string;
    mojo: string;
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

async function getCache(cacheKey: string, validationKey: string, validationTime: number): Promise<unknown> {
    let cachedResponse = null;
    let clearcache = false;
    try {
        cachedResponse = await localforage.getItem(cacheKey);
        if (cachedResponse) {
            const validationResponse = await localforage.getItem(validationKey);
            if (validationResponse && ((new Date().getTime()) - ((validationResponse as Date).getTime())) < validationTime) {
                console.log('Using Cache for ' + validationKey + ' - Time diff: ' + (new Date().getTime() - (validationResponse as Date).getTime()));
                //return cachedResponse;
            } else {
                console.log('Clearing Cache for ' + validationKey + ' - Time diff: ' + (new Date().getTime() - (validationResponse as Date).getTime()));
                localforage.removeItem(cacheKey);
                localforage.removeItem(validationKey);
                cachedResponse = null;
            }
        }
    } catch (error) {
        console.log('Error getting cache for ' + validationKey + ': ' + error);
        cachedResponse = null;
        clearcache = true;
    }
    if (clearcache) {
        try {
            localforage.removeItem(cacheKey);
        } catch (error) {
            console.log('Error clearing cacheKey ' + cacheKey + ': ' + error);
        }
        try {
            localforage.removeItem(validationKey);
        } catch (error) {
            console.log('Error clearing validationKey ' + validationKey + ': ' + error);
        }
    }
    return cachedResponse;
}

async function fetchXCHBalance(usecache: boolean): Promise<string> {
    let response: Balance = {} as Balance;
    const url = 'https://api.coinset.org/get_coin_records_by_hint' + myXCH;
    const cacheKey = url;
    const validationKey = myXCH;
    if (usecache) {
        const payouts = await getCache(cacheKey, validationKey, 299000) as string
        if (payouts && payouts != null) {
            return payouts;
        }
    }
    try {
        response = await window.fetch('https://xchscan.com/api/account/balance?address=' + myXCH, {
            method: "GET",
        }
        ).then(response => response.json());
        try {
            await localforage.setItem(cacheKey, response.xch);
            await localforage.setItem(validationKey, new Date())
        } catch (error) {
            console.log('Error clearing cache in fetchXCHBalance: ' + error);
        }
        return response.xch;
    } catch (error) {
        console.log('Error in fetchXCHBalance: ' + error);
    }
    return 'NA';
}

//Add SWR
async function fetchXCHPrice(usecache: boolean): Promise<number> {
    let response: PriceData = {} as PriceData;
    const url = 'https://semaphoreslim.online/cryptocurrency/quotes/latest?id=9258&convert=USD';
    const cacheKey = url;
    const validationKey = 'XCH';
    if (usecache) {
        const xchprice = await getCache(cacheKey, validationKey, 299000) as number
        if (xchprice && xchprice != null) {
            return xchprice;
        }
    }
    try {
        response = await window.fetch(url, {
            method: "GET",
        }
        ).then(response => response.json());
        try {
            await localforage.setItem(cacheKey, response.data[xchCoinID].quote.USD.price);
            await localforage.setItem(validationKey, new Date())
        } catch (error) {
            console.log('Error setting cache in fetchXCHPrice: ' + error);
        }
        return response.data[xchCoinID].quote.USD.price;
    } catch (error) {
        console.log('Error in fetchXCHPrice: ' + error);
    }
    return 0;
}

//Add SWR
async function fetchXCH(xchurl: string, usecache: boolean): Promise<string> {
    let response: XCH = { xch_address: 'XCH Address' };
    let fetcherror: boolean = false;
    const cacheKey = xchurl;
    const validationKey = 'XCH_Address';
    if (usecache) {
        const xchaddress = await getCache(cacheKey, validationKey, 1800000) as string
        if (xchaddress && xchaddress != null) {
            return xchaddress;
        }
    }
    try {
        response = await window.fetch(xchurl, {
            method: "GET",
        }
        ).then(response => response.json());
        try {
            await localforage.setItem(cacheKey, response.xch_address);
            await localforage.setItem(validationKey, new Date())
        } catch (error) {
            console.log('Error setting cache in fetchXCH: ' + error);
        }
        myPuzzleHash = addresstoPuzzleHash(response.xch_address);
    } catch (error) {
        console.log('caught error in fetchXCH: ' + error)
        fetcherror = true;
    }
    
    if (fetcherror) {
        if (usecache) {
            const xchaddress = await getCache(cacheKey.replace('https://', 'http://'), validationKey, 1800000) as string
            if (xchaddress && xchaddress != null) {
                return xchaddress;
            }
        }
        try {
            //console.log('Retrying with ' + xchurl.replace('https://', 'http://'))
            response = await window.fetch(xchurl.replace('https://', 'http://'), {
                method: "GET",
            }
            ).then(response => response.json());
            storeurl = storeurl.replace('https://', 'http://');
            try {
                await localforage.setItem(storeurl, response.xch_address);
                await localforage.setItem(validationKey, new Date())
            } catch (error) {
                console.log('Error setting cache in fetchXCH: ' + error);
            }
            amisecure = false;
            myPuzzleHash = addresstoPuzzleHash(response.xch_address);
        } catch (error) {
            console.log('caught 2nd error in fetchXCH: ' + error);
        }
    }
    return response.xch_address;
}

async function fetchStores(usecache: boolean): Promise<[StoreData[]]> {
    let hostname = window.location.hostname;

    if (hostname == 'localhost') {
        hostname = 'dig.semaphoreslim.net';
    }
    let dnsdata = null;
    const url = 'https://dns.google/resolve?name=' + hostname;
    let cacheKey = url;
    let validationKey = hostname;
    if (usecache) {
        dnsdata = await getCache(cacheKey, validationKey, 299000)
    }
    if (!dnsdata || dnsdata == null) {
        const dnsresponse: myDNS = await window.fetch(url, {
            method: "GET",
        }).then(dnsresponse => dnsresponse.json());
        try {
            await localforage.setItem(url, dnsresponse.Answer);
            await localforage.setItem(validationKey, new Date())
        } catch (error) {
            console.log('Error setting cache in fetchXCH: ' + error);
        }
        dnsdata = dnsresponse.Answer;
    }
    
    let useXCHAddress: boolean = false;
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
        storeurl = 'http://' + hostname + ':4161';
        amisecure = false;
    }

    if (useXCHAddress) {
        myXCH = await fetchXCH(storeurl + "/.well-known", true);
        if (myXCH.length > 0 && myXCH != 'XCH Address') {
            myBalance = await fetchXCHBalance(true)
            console.log('XCH wallet balance is ' + myBalance);
        }
    }

    xchPrice = await fetchXCHPrice(false);
    console.log('xch Price is ' + xchPrice);

    const dict: StoreData[] = [];
    let indexdata: string = '';
    cacheKey = storeurl;
    validationKey = "indexofstores";
    try {
        //console.log('Getting index with ' + storeurl);
        if (usecache) {
            try {
                indexdata = await getCache(cacheKey, validationKey, 299000) as string;
            }
            catch (error) {
                console.log('Error getting cache for indexofstore: ' + error);
            }
        }
        if (!indexdata || indexdata == null) {
            const indexresponse = await window.fetch(storeurl, {
                method: "GET",
            });
            indexdata = await indexresponse.text();
            try {
                await localforage.setItem(storeurl, indexdata);
                await localforage.setItem(validationKey, new Date())
            } catch (error) {
                console.log('Error setting cache in fetchXCH: ' + error);
            }
        }
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

async function fetchUsers(hint: string, usecache: boolean): Promise<apiResponse> {
    const bodystr = JSON.stringify({
        "hint": hint,
        "start_height": 0,
        "end_height": 0,
        "include_spent_coins": true
    });
    const url = 'https://api.coinset.org/get_coin_records_by_hint';
    const cacheKey = url + '-' + bodystr;
    const validationKey = hint;
    if (usecache) {
        const payouts = await getCache(cacheKey, validationKey, 900000) as apiResponse;
        if (payouts && payouts != null) {
            return payouts;
        }
    }
    const response = await window.fetch(url, {
        method: 'POST',
        body: bodystr,
    });
    const data: apiResponse = await response.json();
    try {
        await localforage.setItem(cacheKey, data);
        await localforage.setItem(validationKey, new Date())
    } catch (error) {
        console.log('Error setting cache items in fetchUsers: ' + error);
    }
    return data;
}

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

    const [searchParams] = useSearchParams();

    const deepStoreID = searchParams.get('storeid');

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
        let refreshed: boolean = false;
        async function getbalance() {
            myBalance = await fetchXCHBalance(false);
            console.log('XCH wallet balance is ' + myBalance);
            setData((prevstate) => ({ ...prevstate, loading: false }));
        }
        if (event.target.value.trim() == '') {
            console.log('reset myXCH');
            myXCH = '';
            myPuzzleHash = '';
            myBalance = 'NA';
        } else {
            myXCH = event.target.value.trim();
            myPuzzleHash = addresstoPuzzleHash(myXCH);
            myBalance = 'Loading...'
        }
        //if (myXCH.length > 0 && myXCH != 'XCH Address') {
        //    myBalance = 'Loading...'
        //}
        if (myStoreID.length > 0) {
            //HandleClick(myStoreID, false, false, true);
            HandleClick(myStoreID, false, true, false);
            refreshed = true;
        }
        //else {
        //    setData((prevstate) => ({ ...prevstate, loading: false }));
        //}
        if (myXCH.length > 0 && myXCH != 'XCH Address' && myXCH != '') {
            getbalance();
            refreshed = true;
        }
        if (!refreshed) {
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
            //HandleClick(myStoreID, true, true, false);
            HandleClick(myStoreID, false, true, false);
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
            if ((!sumsonly && !forceupdate) || initialLoad) {
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
                mydata = await fetchUsers(hashHex, (isTimer ? false : true));
            } else {
                mydata.coin_records = data.users;
            }
            if (isTimer) {
                myBalance = await fetchXCHBalance(false);
                console.log('XCH wallet balance is ' + myBalance);
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
                    console.log('No puzzlehash found - ' + myXCH);
                    tempmysum = 0;
                }
                setData({ users: mydata.coin_records, sum: tempsum, mysum: tempmysum, loading: false })
            }
        }

        async function getPrice(usecache: boolean) {
            xchPrice = await fetchXCHPrice(usecache);
            console.log('xch Price is ' + xchPrice);
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
            if (isTimer) {
                getPrice(false);
            }
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
            try {
                console.log('Fetching stores...');
                setTest((prevstate) => ({ ...prevstate, loading: true }));
                //setTest({ loading: true, users: blank })
                const [dict] = await fetchStores(true);
                setTest({ loading: false, users: dict });
            } catch (error) {
                console.log('Error in fetchData: ' + error);
            }
            console.log('Done fetching stores.');

            if (myXCH != 'XCH Address' && myXCH.length > 0) {
                myPuzzleHash = addresstoPuzzleHash(myXCH);
            }

            if (deepStoreID && initialLoad) {
                myStoreID = deepStoreID;
                console.log('Found deepStoreID');
                setData((prevstate) => ({ ...prevstate, loading: true }));
                HandleClick(deepStoreID, false, false, true);
            }

            if (isMobile && initialLoad) {
                recordoptions = [5, 10, 25, 50, 100];
                myrecordSelection = 5;
                allrecordSelection = 5;
                myEnd = 5;
                allEnd = 5;
            }
            initialLoad = false;
        }
        fetchData();
        
    }, [deepStoreID, isMobile]);
    
    if (!deepStoreID && !isMobile) {
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

    function USDCalc(str: string) {
        const strtonum: number = Number(str);
        if (!isNaN(strtonum)) {
            return '$' + (strtonum * xchPrice).toFixed(2).toString();
        } else {
            return '0';
        }
    }

    

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
                                        <Tooltip content={USDCalc(myBalance)} location='top'>
                                            Wallet Balance: {myBalance}
                                        </Tooltip>
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
                                                <td align="left">
                                                    XCH Price: ${xchPrice.toFixed(2)}
                                                </td>
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
                                                    <h2 key={myStoreID}>Your Payments<br />
                                                        ({Array.isArray(data.users) ?
                                                            <Tooltip content={USDCalc(data.mysum.toString())} location='top'>
                                                                {data.mysum}
                                                            </Tooltip>
                                                        : 0})
                                                    </h2>
                                                    <table border={1} align="center">
                                                        <tbody>
                                                            <tr key='amount'>
                                                                <td style={{ padding: '5px' }}>Amount</td>
                                                                <td style={{ padding: '5px' }}>Address</td>
                                                                <td style={{ padding: '5px' }}>Confirmed at</td>
                                                            </tr>
                                                            {myPuzzleHash && data.users.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash && addy.timestamp >= startepoch && addy.timestamp <= endepoch).sort((a, b) => b.timestamp - a.timestamp).slice(myStart, myEnd).map((store, i) => (
                                                                <tr key={i}>
                                                                    <td style={{ padding: '5px' }}>
                                                                        <Tooltip content={USDCalc((store.coin?.amount * mojo).toString())} location='right'>
                                                                            {(store.coin?.amount * mojo).toFixed(8)}
                                                                        </Tooltip>
                                                                    </td>
                                                                    <td style={{ padding: '5px' }}><a onClick={() => NewTab(store.coin?.puzzle_hash)} style={{ cursor: 'pointer' }}>{truncForMobile(puzzleHashToAddress(store.coin?.puzzle_hash), 5)}</a>&nbsp;&nbsp;
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
                                                    <h2 key={myStoreID}>All Payments<br />
                                                        ({Array.isArray(data.users) ?
                                                            <Tooltip content={USDCalc(data.sum.toString())} location='top'>
                                                                {data.sum}
                                                            </Tooltip>
                                                            : 0})
                                                    </h2>
                                                    <table border={1} align="center">
                                                        <tbody>
                                                            <tr key='amount'>
                                                                <td style={{ padding: '5px' }}>Amount</td>
                                                                <td style={{ padding: '5px' }}>Address</td>
                                                                <td style={{ padding: '5px' }}>Confirmed at</td>
                                                            </tr>
                                                            {data.users.filter(addy => addy.timestamp >= startepoch && addy.timestamp <= endepoch).sort((a, b) => b.timestamp - a.timestamp).slice(allStart, allEnd).map((store, i) => (
                                                                <tr key={i}>
                                                                    <td style={{ padding: '5px' }}>
                                                                        <Tooltip content={USDCalc((store.coin?.amount * mojo).toString())} location='right'>
                                                                            {(store.coin?.amount * mojo).toFixed(8)}
                                                                        </Tooltip>
                                                                    </td>
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
                                    <br />
                                        <Tooltip content={USDCalc(myBalance)} location='bottom'>
                                        Wallet Balance: {myBalance}
                                    </Tooltip>
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
                                            <td align="left">
                                                XCH Price: ${xchPrice.toFixed(2)}
                                            </td>
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
                                                        <h2 key={myStoreID}>All Payments<br />
                                                            ({Array.isArray(data.users) ?
                                                                <Tooltip content={USDCalc(data.sum.toString())} location='bottom'>
                                                                    {data.sum}
                                                                </Tooltip>
                                                                : 0})
                                                        </h2>
                                                <table border={1} align="center">
                                                    <tbody>
                                                        <tr key='amount'>
                                                            <td style={{ padding: '5px' }}>Amount</td>
                                                            <td style={{ padding: '5px' }}>Address</td>
                                                            <td style={{ padding: '5px' }}>Confirmed at</td>
                                                        </tr>
                                                        {data.users.filter(addy => addy.timestamp >= startepoch && addy.timestamp <= endepoch).sort((a, b) => b.timestamp - a.timestamp).slice(allStart, allEnd).map((store, i) => (
                                                            <tr key={i}>
                                                                <td style={{ padding: '5px' }}>
                                                                    <Tooltip content={USDCalc((store.coin?.amount * mojo).toString())} location='right'>
                                                                        {(store.coin?.amount * mojo).toFixed(8)}
                                                                    </Tooltip>
                                                                </td>
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
                                                <h2 key={myStoreID}>Your Payments<br />
                                                    ({Array.isArray(data.users) ?
                                                            <Tooltip content={USDCalc(data.mysum.toString())} location='bottom'>
                                                            {data.mysum}
                                                        </Tooltip>
                                                    : 0})
                                                </h2>
                                                <table border={1} align="center">
                                                    <tbody>
                                                        <tr key='amount'>
                                                            <td style={{ padding: '5px' }}>Amount</td>
                                                            <td style={{ padding: '5px' }}>Address</td>
                                                            <td style={{ padding: '5px' }}>Confirmed at</td>
                                                        </tr>
                                                        {myPuzzleHash && data.users.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash && addy.timestamp >= startepoch && addy.timestamp <= endepoch).sort((a, b) => b.timestamp - a.timestamp).slice(myStart, myEnd).map((store, i) => (
                                                            <tr key={i}>
                                                                <td style={{ padding: '5px' }}>
                                                                    <Tooltip content={USDCalc((store.coin?.amount * mojo).toString())} location='right'>
                                                                        {(store.coin?.amount * mojo).toFixed(8)}
                                                                    </Tooltip>
                                                                </td>
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