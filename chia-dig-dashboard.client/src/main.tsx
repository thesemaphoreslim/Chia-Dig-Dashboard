import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import StoreList from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
            <StoreList label='XCH Address: ' />
    </StrictMode>,
)