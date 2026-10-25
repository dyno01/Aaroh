import React, { useState, useEffect, useRef } from 'react';
import { X, Minimize2, Maximize2, Move, Delete } from 'lucide-react';

export default function ScientificCalculator({ onClose }) {
  const [expr, setExpr] = useState('');
  const [display, setDisplay] = useState('0');
  const [degMode, setDegMode] = useState(true); // true = DEG, false = RAD
  const [isNewNumber, setIsNewNumber] = useState(true);
  const [memory, setMemory] = useState(0);

  // Mobile & Dragging state
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
  const [pos, setPos] = useState({ x: Math.max(20, (typeof window !== 'undefined' ? window.innerWidth : 800) - 380), y: Math.max(60, (typeof window !== 'undefined' ? window.innerHeight : 600) - 560) });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 640);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function onMouseDown(e) {
    if (isMobile) return;
    if (e.target.closest('button')) return; // Don't drag if clicking buttons
    setDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: pos.x,
      posY: pos.y
    };
  }

  useEffect(() => {
    function onMouseMove(e) {
      if (!dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({
        x: Math.max(10, Math.min(window.innerWidth - 340, dragRef.current.posX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 100, dragRef.current.posY + dy))
      });
    }

    function onMouseUp() {
      setDragging(false);
    }

    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  // Factorial helper
  function factorial(n) {
    if (n < 0 || n > 170) return NaN;
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= Math.floor(n); i++) res *= i;
    return res;
  }

  // Handle digit input
  function inputDigit(digit) {
    if (isNewNumber) {
      setDisplay(digit === '.' ? '0.' : digit);
      setIsNewNumber(false);
    } else {
      if (digit === '.' && display.includes('.')) return;
      setDisplay(display === '0' && digit !== '.' ? digit : display + digit);
    }
  }

  // Backspace / CE
  function backspace() {
    if (display.length <= 1 || display === 'Err' || isNewNumber) {
      setDisplay('0');
      setIsNewNumber(true);
    } else {
      setDisplay(display.slice(0, -1));
    }
  }

  // Clear all
  function clearAll() {
    setDisplay('0');
    setExpr('');
    setIsNewNumber(true);
  }

  // Evaluate full expression safely
  function evaluate() {
    try {
      const fullExpr = expr ? `${expr} ${display}` : display;
      let sanitized = fullExpr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/\^/g, '**')
        .replace(/π/g, `${Math.PI}`)
        .replace(/e(?![a-zA-Z])/g, `${Math.E}`);

      // Evaluate
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (!Number.isFinite(result)) {
        setDisplay('Err');
      } else {
        const rounded = Math.round(result * 1e10) / 1e10;
        setDisplay(String(rounded));
        setExpr(`${fullExpr} =`);
      }
    } catch {
      setDisplay('Err');
    }
    setIsNewNumber(true);
  }

  // Binary operators: +, -, ×, ÷, ^, mod
  function handleOperator(op) {
    const currentVal = display === 'Err' ? '0' : display;
    if (expr.endsWith('=')) {
      setExpr(`${currentVal} ${op}`);
    } else {
      setExpr(`${expr} ${currentVal} ${op}`);
    }
    setIsNewNumber(true);
  }

  // Unary scientific functions
  function handleScientific(func) {
    let val = parseFloat(display);
    if (Number.isNaN(val)) return;

    let res = 0;
    const degToRad = (x) => (x * Math.PI) / 180;
    const radToDeg = (x) => (x * 180) / Math.PI;

    switch (func) {
      case 'sin':
        res = Math.sin(degMode ? degToRad(val) : val);
        break;
      case 'cos':
        res = Math.cos(degMode ? degToRad(val) : val);
        break;
      case 'tan':
        res = Math.tan(degMode ? degToRad(val) : val);
        break;
      case 'asin':
        res = degMode ? radToDeg(Math.asin(val)) : Math.asin(val);
        break;
      case 'acos':
        res = degMode ? radToDeg(Math.acos(val)) : Math.acos(val);
        break;
      case 'atan':
        res = degMode ? radToDeg(Math.atan(val)) : Math.atan(val);
        break;
      case 'sqrt':
        res = val >= 0 ? Math.sqrt(val) : NaN;
        break;
      case 'cbrt':
        res = Math.cbrt(val);
        break;
      case 'sqr':
        res = val * val;
        break;
      case 'cube':
        res = val * val * val;
        break;
      case 'inv':
        res = val !== 0 ? 1 / val : NaN;
        break;
      case 'ln':
        res = val > 0 ? Math.log(val) : NaN;
        break;
      case 'log':
        res = val > 0 ? Math.log10(val) : NaN;
        break;
      case 'exp':
        res = Math.exp(val);
        break;
      case 'pow10':
        res = Math.pow(10, val);
        break;
      case 'fact':
        res = factorial(val);
        break;
      case 'abs':
        res = Math.abs(val);
        break;
      case 'sign':
        res = -val;
        break;
      case 'percent':
        res = val / 100;
        break;
      default:
        return;
    }

    if (!Number.isFinite(res)) {
      setDisplay('Err');
    } else {
      const rounded = Math.round(res * 1e10) / 1e10;
      setDisplay(String(rounded));
      setExpr(`${func}(${val})`);
    }
    setIsNewNumber(true);
  }

  // Memory buttons
  function handleMemory(action) {
    const val = parseFloat(display) || 0;
    if (action === 'MC') setMemory(0);
    else if (action === 'MR') {
      setDisplay(String(memory));
      setIsNewNumber(true);
    } else if (action === 'M+') setMemory((m) => m + val);
    else if (action === 'M-') setMemory((m) => m - val);
  }

  // Keyboard support
  useEffect(() => {
    function handleKeyDown(e) {
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.'].includes(e.key)) {
        inputDigit(e.key);
      } else if (e.key === '+') {
        handleOperator('+');
      } else if (e.key === '-') {
        handleOperator('-');
      } else if (e.key === '*') {
        handleOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        evaluate();
      } else if (e.key === 'Backspace') {
        backspace();
      } else if (e.key === 'Escape') {
        if (onClose) onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <>
      {isMobile && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            zIndex: 9998
          }}
          aria-hidden="true"
        />
      )}
      <div
        style={
          isMobile
            ? {
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                width: '100%',
                maxHeight: '92vh',
                background: '#181512',
                color: '#F6F1E8',
                borderRadius: '24px 24px 0 0',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.6)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                userSelect: 'none',
                paddingBottom: 'max(16px, env(safe-area-inset-bottom))'
              }
            : {
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: '350px',
                background: '#181512',
                color: '#F6F1E8',
                borderRadius: 18,
                boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12)',
                zIndex: 9999,
                userSelect: 'none',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }
        }
      >
        {/* Title Bar / Drag Handle */}
        <div
          onMouseDown={onMouseDown}
          style={{
            padding: isMobile ? '12px 16px' : '10px 14px',
            background: 'linear-gradient(90deg, #24201B 0%, #1D1A16 100%)',
            borderBottom: '1px solid #332D26',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: isMobile ? 'default' : dragging ? 'grabbing' : 'grab'
          }}
        >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Move size={14} color="#C9C2B6" />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', color: '#F6F1E8' }}>
            Scientific Calculator
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => setDegMode(!degMode)}
            style={{
              background: degMode ? '#5B45EA' : '#2A2520',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer'
            }}
            title="Toggle Degrees or Radians mode"
          >
            {degMode ? 'DEG' : 'RAD'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#C9C2B6',
              cursor: 'pointer',
              display: 'flex',
              padding: 4
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 2-Line High-Clarity LCD Display */}
      <div style={{ padding: '12px 14px', background: '#0F0D0B', borderBottom: '1px solid #2A2520' }}>
        <div style={{
          height: 18,
          fontSize: 12,
          color: '#9E9484',
          textAlign: 'right',
          fontFamily: 'monospace',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {expr || (memory !== 0 ? `M = ${memory}` : '')}
        </div>
        <div style={{
          fontSize: display.length > 12 ? '22px' : '28px',
          fontWeight: 700,
          color: '#F6F1E8',
          textAlign: 'right',
          fontFamily: 'Outfit, monospace',
          letterSpacing: '-0.02em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginTop: 4
        }}>
          {display}
        </div>
      </div>

      {/* Scientific Keys Grid */}
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* Memory Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
          {['MC', 'MR', 'M+', 'M-', 'CE'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => (m === 'CE' ? backspace() : handleMemory(m))}
              style={{
                background: m === 'CE' ? '#8C2B2B' : '#2A2520',
                color: '#F6F1E8',
                border: '1px solid #3A342E',
                borderRadius: 6,
                padding: '6px 0',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Scientific Functions Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
          {[
            ['sin', () => handleScientific('sin')],
            ['cos', () => handleScientific('cos')],
            ['tan', () => handleScientific('tan')],
            ['π', () => { setDisplay(String(Math.PI)); setIsNewNumber(false); }],
            ['e', () => { setDisplay(String(Math.E)); setIsNewNumber(false); }]
          ].map(([label, action]) => (
            <button
              key={label}
              type="button"
              onClick={action}
              style={{
                background: '#24201B',
                color: '#C9C2B6',
                border: '1px solid #332D26',
                borderRadius: 6,
                padding: '7px 0',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scientific Functions Row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
          {[
            ['x²', () => handleScientific('sqr')],
            ['xʸ', () => handleOperator('^')],
            ['√x', () => handleScientific('sqrt')],
            ['ln', () => handleScientific('ln')],
            ['log', () => handleScientific('log')]
          ].map(([label, action]) => (
            <button
              key={label}
              type="button"
              onClick={action}
              style={{
                background: '#24201B',
                color: '#C9C2B6',
                border: '1px solid #332D26',
                borderRadius: 6,
                padding: '7px 0',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scientific Functions Row 3 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
          {[
            ['1/x', () => handleScientific('inv')],
            ['n!', () => handleScientific('fact')],
            ['|x|', () => handleScientific('abs')],
            ['(', () => { setExpr((e) => `${e} (`); setIsNewNumber(true); }],
            [')', () => { setExpr((e) => `${e} ${display} )`); setIsNewNumber(true); }]
          ].map(([label, action]) => (
            <button
              key={label}
              type="button"
              onClick={action}
              style={{
                background: '#24201B',
                color: '#C9C2B6',
                border: '1px solid #332D26',
                borderRadius: 6,
                padding: '7px 0',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Standard Digits & Ops Keypad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginTop: 4 }}>
          {/* Row 1 */}
          <button
            type="button"
            onClick={clearAll}
            style={{
              background: '#B91C1C',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 0',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            C
          </button>
          <button
            type="button"
            onClick={() => handleScientific('sign')}
            style={{
              background: '#332D26',
              color: '#F6F1E8',
              border: 'none',
              borderRadius: 8,
              padding: '10px 0',
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            ±
          </button>
          <button
            type="button"
            onClick={() => handleScientific('percent')}
            style={{
              background: '#332D26',
              color: '#F6F1E8',
              border: 'none',
              borderRadius: 8,
              padding: '10px 0',
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => handleOperator('÷')}
            style={{
              background: '#F0B429',
              color: '#1B160C',
              border: 'none',
              borderRadius: 8,
              padding: '10px 0',
              fontWeight: 800,
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            ÷
          </button>

          {/* Row 2: 7, 8, 9, × */}
          {['7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => inputDigit(d)}
              style={{
                background: '#2A2520',
                color: '#F6F1E8',
                border: '1px solid #3A342E',
                borderRadius: 8,
                padding: '10px 0',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer'
              }}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('×')}
            style={{
              background: '#F0B429',
              color: '#1B160C',
              border: 'none',
              borderRadius: 8,
              padding: '10px 0',
              fontWeight: 800,
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            ×
          </button>

          {/* Row 3: 4, 5, 6, - */}
          {['4', '5', '6'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => inputDigit(d)}
              style={{
                background: '#2A2520',
                color: '#F6F1E8',
                border: '1px solid #3A342E',
                borderRadius: 8,
                padding: '10px 0',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer'
              }}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('-')}
            style={{
              background: '#F0B429',
              color: '#1B160C',
              border: 'none',
              borderRadius: 8,
              padding: '10px 0',
              fontWeight: 800,
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            -
          </button>

          {/* Row 4: 1, 2, 3, + */}
          {['1', '2', '3'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => inputDigit(d)}
              style={{
                background: '#2A2520',
                color: '#F6F1E8',
                border: '1px solid #3A342E',
                borderRadius: 8,
                padding: '10px 0',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer'
              }}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('+')}
            style={{
              background: '#F0B429',
              color: '#1B160C',
              border: 'none',
              borderRadius: 8,
              padding: '10px 0',
              fontWeight: 800,
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            +
          </button>

          {/* Row 5: 0, 00, ., = */}
          <button
            type="button"
            onClick={() => inputDigit('0')}
            style={{
              background: '#2A2520',
              color: '#F6F1E8',
              border: '1px solid #3A342E',
              borderRadius: 8,
              padding: '10px 0',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            0
          </button>
          <button
            type="button"
            onClick={() => inputDigit('00')}
            style={{
              background: '#2A2520',
              color: '#F6F1E8',
              border: '1px solid #3A342E',
              borderRadius: 8,
              padding: '10px 0',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            00
          </button>
          <button
            type="button"
            onClick={() => inputDigit('.')}
            style={{
              background: '#2A2520',
              color: '#F6F1E8',
              border: '1px solid #3A342E',
              borderRadius: 8,
              padding: '10px 0',
              fontWeight: 700,
              fontSize: 18,
              cursor: 'pointer'
            }}
          >
            .
          </button>
          <button
            type="button"
            onClick={evaluate}
            style={{
              background: '#5B45EA',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 0',
              fontWeight: 900,
              fontSize: 18,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(91, 69, 234, 0.4)'
            }}
          >
            =
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
