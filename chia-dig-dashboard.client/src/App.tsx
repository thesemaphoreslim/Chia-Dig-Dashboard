import { Buffer } from 'buffer';
import './App.css';
import React, { useState, useEffect, useCallback } from 'react';
import { publicIpv4 } from 'public-ip';
import { bech32m } from 'bech32';
import * as CryptoJS from 'crypto-js';

export let myXCH: string = 'XCH Address';
export let myPuzzleHash: string = '';
export const mojo: number = .000000000001;
export let mySecurity: boolean = false;
export let myStoreID: string = '';
// eslint-disable-next-line react-refresh/only-export-components
export let myInterval: NodeJS.Timeout;
export let myIntervalRunning: boolean = false;
export let myStart: number = 0;
export let myEnd: number = 25;
export let allStart: number = 0;
export let allEnd: number = 25;

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
    console.log('My xchurl: ' + xchurl);
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

async function fetchStores(): Promise<[boolean, StoreData[]]> {
    let hostname = window.location.hostname;
    console.log('trying your hostname - ' + hostname)
    if (hostname == 'localhost') {
        hostname = 'dig.semaphoreslim.net';
    }
    const dnsresponse: myDNS = await fetch('https://dns.google/resolve?name=' + hostname, {
        method: "GET"
    }).then(dnsresponse => dnsresponse.json());
    const dnsdata = dnsresponse.Answer;
    //const dnshostname = dnsdata;
    let useXCHAddress: boolean = false;
    console.log(JSON.stringify(dnsdata));
    let storeurl: string = '';
    let isSecure: boolean = true;
    const publicIP = await publicIpv4();
    console.log('My publicIP: ' + publicIP);
    if (publicIP == hostname)
    {
        storeurl = 'http://' + publicIP + ':4161';
        isSecure = false;
        useXCHAddress = true;
    }
    else
    {
        storeurl = 'https://' + hostname;
        isSecure = true;
    }
    console.log(storeurl);
    for (const dnsip of dnsdata) {
        console.log('My dns ip: ' + dnsip.data)
        if (publicIP == dnsip.data) {
            useXCHAddress = true;
        }
    }
    if (useXCHAddress) {
        console.log('Use the XCH address');
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
        //for (const testdata of dict) {
        //    console.log('Key: ' + testdata.key);
        //    console.log('Description: ' + testdata.data.description);
        //    console.log('ID: ' + testdata.data.id);
        //    console.log('Content Length: ' + testdata.data.contentlength);
        //}
    } catch (error) {
        console.log('Error in html parser: ' + error);
    }
    return [isSecure, dict];
    //try {
    //    let response = await fetch(storeurl + '/.well-known/stores', {
    //        method: "GET"
    //    }
    //    );
    //    if (!response.ok) {
    //        console.log('your hostname failed');
    //        hostname = 'dig.semaphoreslim.net';
    //        response = await fetch('https://' + hostname + '/.well-known/stores', {
    //            method: "GET"
    //        });
    //        isSecure = true;
    //    }
    //    return [await response.json(), isSecure, dict];
    //} catch {
    //    console.log('caught error in fetchStores');
    //    hostname = 'dig.semaphoreslim.net';
    //    const response = await fetch('https://' + hostname + '/.well-known/stores', {
    //        method: "GET"
    //    }
    //    );
    //    isSecure = true;
    //    return [await response.json(), isSecure, dict];
    //}
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
    //const [users, setUsers] = useState<string[] | null>([]);
    const [users, setUsers] = useState<StoreData[] | null>([]);
    const [test, setTest] = useState<boolean | true>(false);
    const [error, setError] = useState<string | null>(null);
    const [allstart, allsetStart] = useState<number>(0);
    const [allend, allsetEnd] = useState<number>(25);
    const [mystart, mysetStart] = useState<number>(0);
    const [myend, mysetEnd] = useState<number>(25);
    const [Loading, setLoading] = useState(true);
    const [value, setValue] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const [hint, setHint] = useState<Records>();
    const [amLoading, amsetLoading] = useState(false);
    const [lastUpdate, setlastUpdate] = useState(new Date().toLocaleString());
    const [sum, setSum] = useState(0);
    const [mysum, mysetSum] = useState(0);
    label = 'XCH Address: ';
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
            HandleClick(myStoreID, mySecurity, true);
        }
    }

    const HandleClick = useCallback((storeId: string, isSecure: boolean, isTimer: boolean) => {
        if (!storeId) return;
        async function getHint() {
            console.log({ storeId });
            if (!isTimer) amsetLoading(true);
            const storearray: Buffer = Buffer.from(storeId, 'hex');
            if (!Buffer.isBuffer(storearray) || storearray.length !== 32) {
                throw new Error("Invalid input. Must be a 32-byte buffer.");
            }
            const seed = "digpayment";
            const combinedBuffer = Buffer.concat([Buffer.from(seed), storearray]);

            let hashHex: string = '';
            try {
                if (!isSecure) {
                    const test = combinedBuffer.buffer;
                    hashHex = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(test)).toString(CryptoJS.enc.Hex);
                } else {
                    const hashBuffer = await window.crypto.subtle.digest('SHA-256', combinedBuffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                }
            }
            catch (err) {
                setError((err as Error).message);
            }

            const data = await fetchUsers(hashHex);
            setHint(data.coin_records);
            //myJson = data.coin_records;
            //console.log(data.coin_records);
            //const input = '444947204e6574776f726b207061796f75743a2053746f726520496420633763306263383835623032353331643432633732663131653930626536613232663736616337643436376163626661653736626330326432323231633335322c2045706f636820352c20526f756e6420373239';
            //const output = Buffer.from(input, 'hex');
            //console.log(output.toString());

            if (!isTimer) amsetLoading(false);
            //amsetLoading(false);
            if (!isTimer) setlastUpdate(new Date().toLocaleString());

        }

        if (!myIntervalRunning) {
            console.log('Assigned Interval');
            myInterval = setInterval(() => {
                if (myStoreID) {
                    setIsVisible(true);
                    console.log('Interval met for ' + myStoreID);
                    console.log(isVisible.toString());
                    HandleClick(myStoreID, mySecurity, true);
                    setlastUpdate(new Date().toLocaleString());
                }
            }, 300000);
            myIntervalRunning = true;
        }

        if (!isVisible || isTimer || myStoreID != storeId) {
            getHint();
            setIsVisible(true);
        }
        else {
            console.log('Disabling interval');
            clearInterval(myInterval);
            myIntervalRunning = false;
            setIsVisible(false);
        }
        mySecurity = isSecure;
        myStoreID = storeId;

    }, [isVisible]);

    

    useEffect(() => {
        if (Array.isArray(hint)) {
            let total = hint.reduce((acc, item) => {
                if (typeof item.coin?.amount == 'number' && !isNaN(item.coin?.amount)) {
                    return acc + item.coin?.amount;
                }
                else {
                    return 0;
                }
            }, 0);
            setSum(total * mojo);
            if (myPuzzleHash) {
                total = hint.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash).reduce((acc, item) => {
                    if (typeof item.coin?.amount == 'number' && !isNaN(item.coin?.amount)) {
                        return acc + item.coin?.amount;
                    }
                    else {
                        return 0;
                    }
                }, 0);
                mysetSum(total * mojo);
            } else {
                mysetSum(0);
            }
        }
        else {
            setSum(0);
            mysetSum(0);
        }
    }, [hint]);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                const [isSecure, dict] = await fetchStores();
                //setUsers(data);
                setUsers(dict);
                setLoading(false);
                setTest(isSecure);
            } catch (error) {
                console.log(error);
            }
        }
        fetchData();
    }, []);

    console.log('MyXCH is ' + myXCH);

    if (myXCH != 'XCH Address') {
        myPuzzleHash = addresstoPuzzleHash(myXCH);
    }

    if (error) {
        return <div>Error: {error}</div>;
    }
    if (Loading) return <p>Loading stores...</p>
    if (users?.length)
        return (
            <section>
                <br/><br/>
                <table width="100%">
                    <tbody>
                        <tr>
                            <td align="center">
                                Enter your DIG Node XCH address in the space provided<br/>then click a store ID to view incentive payouts for the store
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
                                        {users.map((store, i) => (
                                            <tr key={i}>
                                                <td align="center" style={{ padding: '10px' }}>
                                                    {store.data.description}
                                                </td>
                                                <td align="center" style={{ padding: '10px' }}>
                                                    <a onClick={() => HandleClick(store.data.id, test, false)} key={store.data.id} style={{ cursor: 'pointer' }}>{store.data.id}</a>
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
                {amLoading && (<p>Loading records...</p>)}
                {isVisible && Array.isArray(hint) && (
                    <div>
                    <section>
                        <p>Last Updated: {lastUpdate}</p>
                        {/*<h2>Total Incentives Paid for this Store: {Array.isArray(hint) ? sum : 0}</h2>*/}
                        <table id="records" border={1} width="100%" align="center">
                            <tbody>
                                <tr>
                                    <td width="50%">
                                            <h2 key={myStoreID}>All Payments ({Array.isArray(hint) ? sum : 0})</h2>
                                        <table border={1} align="center">
                                            <tbody>
                                                <tr key='amount'>
                                                        <td style={{ padding: '5px' }}>Amount</td>
                                                        <td style={{ padding: '5px' }}>Address</td>
                                                        <td style={{ padding: '5px' }}>Confirmed at</td>
                                                </tr>
                                                {hint.sort((a, b) => b.timestamp - a.timestamp).slice(allstart, allend).map((store, i) => (
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
                                                        <button onClick={() => HandleNext()} disabled={hint.length <= allend}>Next</button>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                    <td width="50%">
                                            <h2 key={myStoreID}>Your Payments ({Array.isArray(hint) ? mysum : 0})</h2>
                                        <table border={1} align="center">
                                            <tbody>
                                                <tr key='amount'>
                                                        <td style={{ padding: '5px' }}>Amount</td>
                                                        <td style={{ padding: '5px' }}>Address</td>
                                                        <td style={{ padding: '5px' }}>Confirmed at</td>
                                                </tr>
                                                {myPuzzleHash && hint.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash).sort((a, b) => b.timestamp - a.timestamp).slice(mystart, myend).map((store, i) => (
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
                                                        <button onClick={() => YourHandleNext()} disabled={hint.filter(addy => addy.coin?.puzzle_hash === myPuzzleHash).length <= myend}>Next</button>
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