import { Buffer } from 'buffer';
import './App.css';
import React, { useState, useEffect, useCallback } from 'react';
import { publicIpv4 } from 'public-ip';
import { bech32m } from 'bech32';
import * as CryptoJS from 'crypto-js';
import { useSearchParams } from 'react-router-dom';

export let myXCH: string = 'XCH Address';
export let myPuzzleHash: string = '';
export const mojo: number = .000000000001;
export let myStoreID: string = '';
// eslint-disable-next-line react-refresh/only-export-components
export let myInterval: NodeJS.Timeout;
export let myIntervalRunning: boolean = false;
export let myStart: number = 0;
export let myEnd: number = 25;
export let allStart: number = 0;
export let allEnd: number = 25;
export let initialLoad: boolean = true;
export let amisecure: boolean = true;
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
    //console.log('My xchurl: ' + xchurl);
    try {
        response = await fetch(xchurl, {
            method: "GET"
        }
        ).then(response => response.json());
        return response.xch_address;
    } catch {
        console.log('caught error in fetchXCH')
        response = await fetch('https://dig.semaphoreslim.net/.well-known', {
            method: "GET"
        }
        ).then(response => response.json());
    }
    return '';
}

async function fetchStores(): Promise<[StoreData[]]> {
    let hostname = window.location.hostname;
    //console.log('trying your hostname - ' + hostname)
    if (hostname == 'localhost') {
        hostname = 'dig.semaphoreslim.net';
    }
    const dnsresponse: myDNS = await fetch('https://dns.google/resolve?name=' + hostname, {
        method: "GET"
    }).then(dnsresponse => dnsresponse.json());
    const dnsdata = dnsresponse.Answer;
    let useXCHAddress: boolean = false;
    //console.log(JSON.stringify(dnsdata));
    let storeurl: string = '';
    const publicIP = await publicIpv4();
    //console.log('My publicIP: ' + publicIP);
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
    //console.log(storeurl);
    for (const dnsip of dnsdata) {
        //console.log('My dns ip: ' + dnsip.data)
        if (publicIP == dnsip.data) {
            useXCHAddress = true;
        }
    }
    if (useXCHAddress) {
        //console.log('Use the XCH address');
        myXCH = await fetchXCH(storeurl + "/.well-known");
    }
    //console.log('Now we are here')
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

interface Props {
    label: string;
}

const StoreList: React.FC<Props> = ({ label }) => {
    console.log('Rendering');
    const [allstart, allsetStart] = useState<number>(0);
    const [allend, allsetEnd] = useState<number>(25);
    const [mystart, mysetStart] = useState<number>(0);
    const [myend, mysetEnd] = useState<number>(25);
    const [value, setValue] = useState('');
    label = 'XCH Address: ';

    const [searchParams] = useSearchParams();

    const deepStoreID = searchParams.get('storeid');

    const HandleNext = useCallback(() => {
        allStart = allStart + 25;
        allEnd = allEnd + 25;
        allsetStart(allStart);
        allsetEnd(allEnd);
        console.log('Adding records');
    }, []);

    const HandlePrev = useCallback(() => {
        allStart = allStart - 25;
        allEnd = allEnd - 25;
        allsetStart(allStart);
        allsetEnd(allEnd);
        console.log('Removing records');
    }, []);

    const YourHandleNext = useCallback(() => {
        myStart = myStart + 25;
        myEnd = myEnd + 25;
        mysetStart(myStart);
        mysetEnd(myEnd);
        console.log('Adding records');
    }, []);

    const YourHandlePrev = useCallback(() => {
        myStart = myStart - 25;
        myEnd = myEnd - 25;
        mysetStart(myStart);
        mysetEnd(myEnd);
        console.log('Removing records');
    }, []);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log('We are in handleChange');
        myXCH = event.target.value;
        myPuzzleHash = addresstoPuzzleHash(myXCH);
        setValue(event.target.value);
        if (myStoreID) {
            HandleClick(myStoreID, true);
        }
    }

    const blankRecords: Records = {};

    const [data, setData] = useState({
        sum: 0,
        mysum: 0,
        users: blankRecords,
    });

    const HandleClick = useCallback((storeId: string, isTimer: boolean) => {
        if (!storeId) {
            return;
        }
        if (storeId == myStoreID && !initialLoad) {
            myStoreID = '';
            clearInterval(myInterval);
            console.log('Cleared interval');
            myIntervalRunning = false;
            setData({ users: {}, sum: 0, mysum: 0 })
            return;
        }
        async function getHint() {
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

            const data = await fetchUsers(hashHex);
            let tempsum = 0;
            let tempmysum = 0;
            if (Array.isArray(data.coin_records)) {
                let total = data.coin_records.reduce((acc, item) => {
                    if (typeof item.coin?.amount == 'number' && !isNaN(item.coin?.amount)) {
                        return acc + item.coin?.amount;
                    }
                    else {
                        return 0;
                    }
                }, 0);
                tempsum = (total * mojo)
                if (myPuzzleHash) {
                    total = data.coin_records.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash).reduce((acc, item) => {
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
                console.log('setData');
                setData({ users: data.coin_records, sum: tempsum, mysum: tempmysum })
            }
        }

        if (!myIntervalRunning) {
            console.log('Assigned Interval');
            myInterval = setInterval(() => {
                if (myStoreID) {
                    console.log('Interval met for ' + myStoreID);
                    const tempid = myStoreID;
                    myStoreID = '';
                    HandleClick(tempid, true);
                }
            }, 300000);
            myIntervalRunning = true;
        }

        if (isTimer || myStoreID != storeId) {
            console.log('Running getHint');
            myStoreID = storeId;
            getHint();
        }
        else {
            console.log('Disabling interval');
            clearInterval(myInterval);
            myIntervalRunning = false;
            myStoreID = '';
            //setHint({});
            setData({ users: {}, sum: 0, mysum: 0 });
        }
    }, []);


    //useEffect(() => {
    //    let tempsum = 0;
    //    let tempmysum = 0;
    //    if (Array.isArray(hint)) {
    //        let total = hint.reduce((acc, item) => {
    //            if (typeof item.coin?.amount == 'number' && !isNaN(item.coin?.amount)) {
    //                return acc + item.coin?.amount;
    //            }
    //            else {
    //                return 0;
    //            }
    //        }, 0);
    //        tempsum = (total * mojo)
    //        if (myPuzzleHash) {
    //            total = hint.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash).reduce((acc, item) => {
    //                if (typeof item.coin?.amount == 'number' && !isNaN(item.coin?.amount)) {
    //                    return acc + item.coin?.amount;
    //                }
    //                else {
    //                    return 0;
    //                }
    //            }, 0);
    //            tempmysum = (total * mojo);
    //        } else {
    //            tempmysum = 0;
    //        }
    //        setData({ sum: tempsum, mysum: tempmysum })
    //    }
    //}, [hint]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if(myXCH != 'XCH Address') {
        myPuzzleHash = addresstoPuzzleHash(myXCH);
    }

    //useEffect(() => {
        if (deepStoreID && initialLoad) {
            myStoreID = deepStoreID;
            HandleClick(deepStoreID, true);
            initialLoad = false;
        }
    //}, [HandleClick, deepStoreID]);

    //if (Loading) {
    if (test.loading) {
        return <p>Loading stores...</p>
        //} else if (users?.length) {
    } else if (test.users?.length) {
        return (
            <section>
                <br /><br />
                <table width="100%">
                    <tbody>
                        <tr>
                            <td align="center">
                                Enter your DIG Node XCH address in the space provided<br />then click a store ID to view incentive payouts for the store
                                <br /><br />
                                <input type="text" id={label} value={value} placeholder={myXCH} onChange={handleChange} style={{ width: '450px' }} />
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
                                        {/*{Loading.users.map((store, i) => (*/}
                                        {test.users.map((store, i) => (
                                            <tr key={i}>
                                                <td align="center" style={{ padding: '10px' }}>
                                                    {store.data.description}
                                                </td>
                                                <td align="center" style={{ padding: '10px' }}>
                                                    <a onClick={() => HandleClick(store.data.id, false)} key={store.data.id} style={{ cursor: 'pointer' }}>{store.data.id}</a>
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
                {/*{amLoading && (<p>Loading records...</p>)}*/}
                {Array.isArray(data.users) && (
                    <div>
                        <section>
                            {/*<p>Last Updated: {lastUpdate}</p>*/}
                            <p>Last Updated: {new Date().toLocaleString()}</p>
                            <p>Store ID: {myStoreID}</p>
                            {/*<h2>Total Incentives Paid for this Store: {Array.isArray(hint) ? sum : 0}</h2>*/}
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
                                                    {data.users.sort((a, b) => b.timestamp - a.timestamp).slice(allstart, allend).map((store, i) => (
                                                        <tr key={i}>
                                                            <td style={{ padding: '5px' }}>{((store.coin?.amount) * mojo).toFixed(8)}</td>
                                                            <td style={{ padding: '5px' }}><a onClick={() => NewTab(store.coin?.puzzle_hash)} style={{ cursor: 'pointer' }}>{puzzleHashToAddress(store.coin?.puzzle_hash)}</a></td>
                                                            <td style={{ padding: '5px' }}>{(new Date(store.timestamp * 1000)).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                    <tr key='next'>
                                                        <td>
                                                            <button onClick={() => HandlePrev()} disabled={allstart <= 0}>Prev</button>
                                                        </td>
                                                        <td>
                                                        </td>
                                                        <td>
                                                            <button onClick={() => HandleNext()} disabled={data.users.length <= allend}>Next</button>
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
                                                    {myPuzzleHash && data.users.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash).sort((a, b) => b.timestamp - a.timestamp).slice(mystart, myend).map((store, i) => (
                                                        <tr key={i}>
                                                            <td style={{ padding: '5px' }}>{(store.coin?.amount * .000000000001).toFixed(8)}</td>
                                                            <td style={{ padding: '5px' }}><a onClick={() => NewTab(store.coin?.puzzle_hash)} style={{ cursor: 'pointer' }}>{puzzleHashToAddress(store.coin?.puzzle_hash)}</a></td>
                                                            <td style={{ padding: '5px' }}>{(new Date(store.timestamp * 1000)).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                    <tr key='next'>
                                                        <td>
                                                            <button onClick={() => YourHandlePrev()} disabled={mystart <= 0}>Prev</button>
                                                        </td>
                                                        <td>
                                                        </td>
                                                        <td>
                                                            <button onClick={() => YourHandleNext()} disabled={data.users.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash).length <= myend}>Next</button>
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

                )}
            </section>
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