import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

// 中文數字轉換（將數字轉換為中文讀法）
const numberToChinese = (num) => {
  const units = ['', '十', '百', '千', '萬']
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  
  if (num === 0) return '零'
  
  const numStr = String(num)
  const len = numStr.length
  let result = ''
  let prevWasZero = false
  
  for (let i = 0; i < len; i++) {
    const digit = parseInt(numStr[i])
    const power = len - i - 1
    
    if (digit === 0) {
      if (!prevWasZero && power > 0 && result.length > 0) {
        result += '零'
        prevWasZero = true
      }
    } else {
      if (prevWasZero || (i > 0 && digit === 1 && power === 1)) {
        // 十位是1時不讀"一十"
        if (power === 1) {
          result = result.slice(0, -1) // 移除之前的"零"
        }
      }
      result += digits[digit]
      if (power > 0) {
        result += units[power]
      }
      prevWasZero = false
    }
  }
  
  // 移除末尾的"零"
  return result.replace(/零+$/, '') || '零'
}

// 生成指定位數的隨機數字
const generateNumber = (digits) => {
  const firstDigit = Math.floor(Math.random() * 9) + 1
  const restDigits = Array.from({ length: digits - 1 }, () => 
    Math.floor(Math.random() * 10)
  )
  return [firstDigit, ...restDigits].join('')
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
  const [isReading, setIsReading] = useState(false)
  const timerRef = useRef(null)
  const isReadingRef = useRef(false)

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    isReadingRef.current = false
    setIsReading(false)
  }, [])

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    timerRef.current = setInterval(() => {
      // 只有在非朗讀狀態時才倒數
      if (!isReadingRef.current) {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            return 0
          }
          return prev - 1
        })
      }
    }, 1000)
  }, [])

  const speakNumber = useCallback((number, onComplete) => {
    stopSpeaking()
    isReadingRef.current = true
    setIsReading(true)
    
    // 將數字轉換為中文讀法
    const chineseText = numberToChinese(parseInt(number))
    
    const utterance = new SpeechSynthesisUtterance(chineseText)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.8
    utterance.pitch = 1.0
    
    utterance.onend = () => {
      isReadingRef.current = false
      setIsReading(false)
      if (onComplete) onComplete()
    }
    
    utterance.onerror = () => {
      isReadingRef.current = false
      setIsReading(false)
      if (onComplete) onComplete()
    }
    
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }, [stopSpeaking])

  const generateNextNumber = useCallback(() => {
    setCurrentNumber(generateNumber(digits))
    setTimeLeft(countdownSeconds)
    // 新數字出現後開始計時，3秒後開始朗讀
    startTimer()
    
    setTimeout(() => {
      speakNumber(generateNumber(digits), null)
    }, 3000)
  }, [digits, countdownSeconds, speakNumber, startTimer])

  // 初始化：顯示數字後開始計時
  useEffect(() => {
    setTimeLeft(countdownSeconds)
    startTimer()
    
    // 3秒後開始朗讀第一個數字
    const timer = setTimeout(() => {
      speakNumber(currentNumber, null)
    }, 3000)
    
    return () => {
      clearTimeout(timer)
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      stopSpeaking()
    }
  }, [])

  // 監聽時間歸零
  useEffect(() => {
    if (timeLeft === 0 && !isReading) {
      // 時間到，朗讀當前數字
      speakNumber(currentNumber, () => {
        // 朗讀完成後，3秒後切換到下一題
        setTimeout(() => {
          generateNextNumber()
        }, 3000)
      })
    }
  }, [timeLeft, isReading, currentNumber, speakNumber, generateNextNumber])

  const handleNext = () => {
    if (isReading) return
    
    // 停止當前計時
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    // 立即朗讀當前數字
    speakNumber(currentNumber, () => {
      // 朗讀完成後，3秒後切換到下一題
      setTimeout(() => {
        generateNextNumber()
      }, 3000)
    })
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
          <span key={index} className="digit">
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
