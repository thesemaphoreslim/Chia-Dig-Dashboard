import { createRoot } from 'react-dom/client'
import StoreList from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')!).render(
        <BrowserRouter>
            <StoreList />
        </BrowserRouter>
)