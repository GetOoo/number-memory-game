import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

// 粵語數字讀音映射
const cantoneseNumbers = {
  '0': { zh: '零', yue: 'ling4' },
  '1': { zh: '一', yue: 'jat1' },
  '2': { zh: '二', yue: 'ji6' },
  '3': { zh: '三', yue: 'saam1' },
  '4': { zh: '四', yue: 'sei3' },
  '5': { zh: '五', yue: 'ng5' },
  '6': { zh: '六', yue: 'luk6' },
  '7': { zh: '七', yue: 'cat1' },
  '8': { zh: '八', yue: 'baat3' },
  '9': { zh: '九', yue: 'gau2' }
}

// 生成指定位數的隨機數字
const generateNumber = (digits) => {
  const firstDigit = Math.floor(Math.random() * 9) + 1
  const restDigits = Array.from({ length: digits - 1 }, () => 
    Math.floor(Math.random() * 10)
  )
  return [firstDigit, ...restDigits].join('')
}

// 朗讀數字（逐個讀）
const speakNumber = (number, onDigitChange, onComplete) => {
  const digits = number.split('')
  let index = 0
  
  const speakNext = () => {
    if (index < digits.length) {
      const digit = digits[index]
      const { yue } = cantoneseNumbers[digit]
      
      onDigitChange(index)
      
      const utterance = new SpeechSynthesisUtterance(yue)
      utterance.lang = 'zh-CN'
      utterance.rate = 0.8
      utterance.pitch = 1.1
      
      utterance.onend = () => {
        index++
        if (index < digits.length) {
          setTimeout(speakNext, 400)
        } else {
          onDigitChange(-1)
          onComplete()
        }
      }
      
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    }
  }
  
  speakNext()
}

// 主頁組件
const HomePage = ({ onStart }) => {
  const [digits, setDigits] = useState(3)
  const [seconds, setSeconds] = useState(10)

  return (
    <div className="home-page">
      <div className="card">
        <h1 className="title">🔢 數字記憶小遊戲</h1>
        <p className="subtitle">訓練你的數字記憶力！</p>
        
        <div className="input-group">
          <label htmlFor="digits">位數 (1-6)</label>
          <input
            id="digits"
            type="number"
            min="1"
            max="6"
            value={digits}
            onChange={(e) => setDigits(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="seconds">倒數秒數 (5-30)</label>
          <input
            id="seconds"
            type="number"
            min="5"
            max="30"
            value={seconds}
            onChange={(e) => setSeconds(Math.max(5, Math.min(30, parseInt(e.target.value) || 10)))}
          />
        </div>
        
        <button className="start-btn" onClick={() => onStart(digits, seconds)}>
          開始遊戲 🚀
        </button>
      </div>
    </div>
  )
}

// 遊戲頁面組件
const GamePage = ({ digits, countdownSeconds, onExit }) => {
  const [currentNumber, setCurrentNumber] = useState(() => generateNumber(digits))
  const [timeLeft, setTimeLeft] = useState(countdownSeconds)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isReading, setIsReading] = useState(false)
  const timerRef = useRef(null)
  const isCountingRef = useRef(true)

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsReading(false)
    setHighlightedIndex(-1)
  }, [])

  const speakAndAdvance = useCallback(() => {
    stopSpeaking()
    setIsReading(true)
    
    speakNumber(
      currentNumber,
      (idx) => setHighlightedIndex(idx),
      () => {
        setIsReading(false)
        setHighlightedIndex(-1)
        setTimeout(() => {
          setCurrentNumber(generateNumber(digits))
          setTimeLeft(countdownSeconds)
          isCountingRef.current = true
        }, 3000)
      }
    )
  }, [currentNumber, digits, countdownSeconds, stopSpeaking])

  useEffect(() => {
    if (isReading) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setInterval(() => {
      if (isCountingRef.current) {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            isCountingRef.current = false
            return 0
          }
          return prev - 1
        })
      }
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isReading])

  useEffect(() => {
    if (timeLeft === 0 && !isReading) {
      speakAndAdvance()
    }
  }, [timeLeft, isReading, speakAndAdvance])

  useEffect(() => {
    return () => {
      stopSpeaking()
    }
  }, [stopSpeaking])

  const handleNext = () => {
    stopSpeaking()
    speakAndAdvance()
  }

  const getNumberFontSize = () => {
    const sizeMap = { 1: 200, 2: 180, 3: 160, 4: 140, 5: 120, 6: 100 }
    return sizeMap[digits] || 120
  }

  return (
    <div className="game-page">
      <div className="timer">
        ⏱️ {timeLeft} 秒
      </div>

      <div className="number-display" style={{ fontSize: `${getNumberFontSize()}px` }}>
        {currentNumber.split('').map((digit, index) => (
          <span
            key={index}
            className={`digit ${highlightedIndex === index ? 'highlighted' : ''}`}
          >
            {digit}
          </span>
        ))}
      </div>

      <div className="controls">
        <button 
          className="next-btn" 
          onClick={handleNext}
          disabled={isReading}
        >
          Next ▶️
        </button>
        
        <button className="exit-btn" onClick={onExit}>
          Exit 🚪
        </button>
      </div>
    </div>
  )
}

function App() {
  const [gameState, setGameState] = useState('home')
  const [settings, setSettings] = useState({ digits: 3, seconds: 10 })

  const handleStart = (digits, seconds) => {
    setSettings({ digits, seconds })
    setGameState('game')
  }

  const handleExit = () => {
    window.speechSynthesis.cancel()
    setGameState('home')
  }

  return (
    <div className="app">
      {gameState === 'home' && (
        <HomePage onStart={handleStart} />
      )}
      {gameState === 'game' && (
        <GamePage 
          digits={settings.digits} 
          countdownSeconds={settings.seconds}
          onExit={handleExit}
        />
      )}
    </div>
  )
}

export default App
