import React, { useState, useRef } from 'react';

interface TooltipProps {
    content: string;
    location: string;
    children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ content, location, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);
    let top: string = '0%';
    let right: string = '100%';
    let left: string = '-100%';
    let bottom: string = '-100%';
    if (location == 'right') {
        top = '-5px';
        bottom = '0px';
        right = '0px';
        left = '100%';
    }
    if (location == 'bottom') {
        top = '20px';
        bottom = '0px';
        right = '0px';
        left = '100px';
    }
    if (location == 'top') {
        top = '-30px';
        bottom = '0px';
        right = '-25px';
        left = '100px';
    }
    const handleMouseEnter = () => {
        setIsVisible(true);
    };

    const handleMouseLeave = () => {
        setIsVisible(false);
    };

    function widthCalc() {
        return content.length * 7;
    }

    return (
        <div onMouseEnter= { handleMouseEnter } onMouseLeave = { handleMouseLeave } style={{ display: 'inline-flex', position: 'relative' }}>
    
{isVisible && (
        <div ref={ tooltipRef } style={{
                    position: 'absolute',
        fontSize: '12px',
                    top: top,
                    right: right,
                    left: left,
                    bottom: bottom,
                    width: widthCalc(),
                    height: '20px',
                    fontStyle: 'normal',
        transform: 'translateX(-50%)',
        backgroundColor: 'black',
        padding: '5px',
        border: '1px solid gray',
        borderRadius: '5px' }} >
        { content }
        </div>
    )}
    {children}
    </div>
  );
};

export default Tooltip;