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
  const [language, setLanguage] = useState('zh-CN')

  return (
    <div className="home-page">
      <div className="card">
        <h1 className="title">🔢 讀數小遊戲</h1>
        <p className="subtitle">熟悉數字！</p>
        
        <div className="input-group">
          <label htmlFor="digits">位數 (1-5)</label>
          <input
            id="digits"
            type="number"
            min="1"
            max="5"
            value={digits}
            onChange={(e) => setDigits(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="seconds">倒數秒數 (2-15)</label>
          <input
            id="seconds"
            type="number"
            min="2"
            max="15"
            value={seconds}
            onChange={(e) => setSeconds(Math.max(5, Math.min(30, parseInt(e.target.value) || 10)))}
          />
        </div>

        <div className="input-group">
          <label htmlFor="language">朗讀語言</label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="language-select"
          >
            <option value="zh-CN">🇨🇳 普通話</option>
            <option value="zh-HK">🇭🇰 粵語</option>
          </select>
        </div>
        
        <button className="start-btn" onClick={() => onStart(digits, seconds, language)}>
          開始遊戲 🚀
        </button>
      </div>
    </div>
  )
}

// 遊戲頁面組件
const GamePage = ({ digits, countdownSeconds, language, onExit }) => {
  const [currentNumber, setCurrentNumber] = useState(() => generateNumber(digits))
  const [timeLeft, setTimeLeft] = useState(countdownSeconds)
  const [isReading, setIsReading] = useState(false)
  const [readCount, setReadCount] = useState(0) // 已朗讀次數
  const [phase, setPhase] = useState('countdown') // 'countdown' | 'reading' | 'waiting'
  const [cursorIndex, setCursorIndex] = useState(-1) // 當前游標位置 (-1表示無游標)
  
  const timerRef = useRef(null)
  const readCountRef = useRef(0)
  const phaseRef = useRef('countdown')
  const cursorTimerRef = useRef(null)
  const isWarmedRef = useRef(false)

  // 保持 ref 同步
  useEffect(() => {
    readCountRef.current = readCount
    phaseRef.current = phase
  }, [readCount, phase])

  // 預熱 speechSynthesis（解決第一次朗讀問題）
  useEffect(() => {
    const selectVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      let selectedVoice = null
      
      if (language === 'zh-HK') {
        // 粵語：查找粵語語音
        selectedVoice = voices.find(v => 
          v.lang.includes('HK') || 
          v.lang.toLowerCase().includes('cantonese') ||
          v.lang.includes('yue')
        )
      } else {
        // 普通話：查找普通話語音
        selectedVoice = voices.find(v => 
          v.lang.includes('CN') || 
          v.lang.includes('Mandarin')
        ) || voices.find(v => v.lang.includes('zh'))
      }
      
      speakNumber._selectedVoice = selectedVoice || null
      console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`))
      console.log('Selected voice:', selectedVoice?.name || 'none')
    }
    
    // 立即嘗試獲取語音
    selectVoice()
    
    // 如果語音還沒加載，監聽 voiceschanged 事件
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        selectVoice()
        console.log('Voices loaded after voiceschanged event')
      })
    }
    
    if (!isWarmedRef.current) {
      const warmUp = new SpeechSynthesisUtterance(' ')
      if (speakNumber._selectedVoice) {
        warmUp.voice = speakNumber._selectedVoice
      } else {
        warmUp.lang = language
      }
      warmUp.volume = 0
      window.speechSynthesis.speak(warmUp)
      setTimeout(() => {
        window.speechSynthesis.cancel()
        isWarmedRef.current = true
      }, 100)
    }
  }, [language])

  // 清除游標計時器
  const clearCursorTimer = () => {
    if (cursorTimerRef.current) {
      clearInterval(cursorTimerRef.current)
      cursorTimerRef.current = null
    }
  }

  // 停止朗讀並清除游標
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsReading(false)
    setCursorIndex(-1)
    clearCursorTimer()
  }, [])

  // 朗讀數字（帶游標效果）- 完整朗讀數字，游標跟隨進度
  const speakNumber = useCallback((number, onComplete) => {
    const numDigits = number.length
    const chineseText = numberToChinese(parseInt(number))
    
    // 估算朗讀時間：根據中文字數和朗讀速度
    const estimatedCharDuration = 350 
    const totalDuration = chineseText.length * estimatedCharDuration
    const timePerDigit = totalDuration / numDigits
    
    let currentIndex = 0
    let hasStarted = false
    
    const moveCursor = () => {
      if (!hasStarted) return
      currentIndex++
      if (currentIndex < numDigits) {
        setCursorIndex(currentIndex)
        cursorTimerRef.current = setTimeout(moveCursor, timePerDigit)
      }
    }
    
    // 創建朗讀
    const utterance = new SpeechSynthesisUtterance(chineseText)
    utterance.lang = language
    utterance.rate = 0.9
    utterance.pitch = 1.0
    
    // 如果有選中的語音，優先使用
    if (speakNumber._selectedVoice) {
      utterance.voice = speakNumber._selectedVoice
      utterance.lang = speakNumber._selectedVoice.lang
    }
    
    utterance.onstart = () => {
      hasStarted = true
      setCursorIndex(0)
      cursorTimerRef.current = setTimeout(moveCursor, timePerDigit)
    }
    
    utterance.onend = () => {
      clearCursorTimer()
      setCursorIndex(-1)
      hasStarted = false
      if (onComplete) onComplete()
    }
    
    utterance.onerror = () => {
      clearCursorTimer()
      setCursorIndex(-1)
      hasStarted = false
      if (onComplete) onComplete()
    }
    
    // 清除之前的朗讀，延遲後開始新的（解決第一次朗讀問題）
    window.speechSynthesis.cancel()
    setTimeout(() => {
      window.speechSynthesis.speak(utterance)
    }, 50)
  }, [language])

  // 開始朗讀流程（朗讀2次）
  const startReadingCycle = useCallback((number) => {
    if (phaseRef.current !== 'countdown') return
    
    // 停止計時
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    setPhase('reading')
    setIsReading(true)
    let count = 0
    
    const readNext = () => {
      count++
      setReadCount(count)
      
      if (count <= 2) {
        speakNumber(number, () => {
          // 兩次朗讀之間休息1秒
          if (count < 2) {
            setTimeout(readNext, 1000)
          } else {
            // 朗讀完成，等待3秒後切換到下一題
            setIsReading(false)
            setPhase('waiting')
            setTimeout(() => {
              if (phaseRef.current === 'waiting') {
                // 切換到下一題並重啟計時
                setCurrentNumber(generateNumber(digits))
                setTimeLeft(countdownSeconds)
                setReadCount(0)
                setPhase('countdown')
                
                // 重啟計時器
                if (timerRef.current) {
                  clearInterval(timerRef.current)
                }
                timerRef.current = setInterval(() => {
                  if (phaseRef.current === 'countdown') {
                    setTimeLeft((prev) => {
                      if (prev <= 1) {
                        // 時間到，開始朗讀
                        clearInterval(timerRef.current)
                        timerRef.current = null
                        return 0
                      }
                      return prev - 1
                    })
                  }
                }, 1000)
              }
            }, 1000)
          }
        })
      }
    }
    
    readNext()
  }, [digits, countdownSeconds, speakNumber])

  // 處理 Next 按鈕
  const handleNext = useCallback(() => {
    if (phaseRef.current === 'reading' || phaseRef.current === 'waiting') return
    startReadingCycle(currentNumber)
  }, [currentNumber, startReadingCycle])

  // 初始化計時器
  useEffect(() => {
    setTimeLeft(countdownSeconds)
    
    timerRef.current = setInterval(() => {
      if (phaseRef.current === 'countdown') {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // 時間到，開始朗讀
            clearInterval(timerRef.current)
            timerRef.current = null
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
      clearCursorTimer()
      stopSpeaking()
    }
  }, [stopSpeaking])

  // 監聽時間歸零
  useEffect(() => {
    if (timeLeft === 0 && phase === 'countdown') {
      startReadingCycle(currentNumber)
    }
  }, [timeLeft, phase, currentNumber, startReadingCycle])

  const getNumberFontSize = () => {
    const sizeMap = { 1: 200, 2: 180, 3: 160, 4: 140, 5: 120 }
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
            className={`digit ${cursorIndex === index ? 'cursor' : ''}`}
          >
            {digit}
            {cursorIndex === index && <span className="cursor-underline"></span>}
          </span>
        ))}
      </div>

      <div className="controls">
        <button 
          className="next-btn" 
          onClick={handleNext}
          disabled={phase !== 'countdown'}
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
  const [settings, setSettings] = useState({ digits: 3, seconds: 10, language: 'zh-CN' })

  const handleStart = (digits, seconds, language) => {
    setSettings({ digits, seconds, language })
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
          language={settings.language}
          onExit={handleExit}
        />
      )}
    </div>
  )
}

export default App