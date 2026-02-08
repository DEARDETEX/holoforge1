import React, { useState } from 'react';

// Simple test version to verify React is working
function App() {
    const [testState, setTestState] = useState('HoloForge Loading...');
    
    React.useEffect(() => {
        setTimeout(() => setTestState('HoloForge Ready!'), 1000);
    }, []);

    return (
        <div style={{ 
            width: '100vw', 
            height: '100vh', 
            backgroundColor: '#222',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            fontFamily: 'Arial, sans-serif'
        }}>
            <h1 style={{ color: '#00ffff', marginBottom: '20px' }}>
                🚀 {testState}
            </h1>
            <p>Simple test interface is working</p>
        </div>
    );
}

export default App;