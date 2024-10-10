//import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import StoreList from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')!).render(
    /*<StrictMode>*/
        <BrowserRouter>
            <StoreList label='XCH Address: ' />
        </BrowserRouter>
    /*</StrictMode>,*/
)