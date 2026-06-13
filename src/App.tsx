import React, { useState, useRef, useEffect } from 'react';
import { Camera, Search, Flame, Droplet, Apple, FileWarning, ChevronLeft, ChevronRight, Plus, Award, CheckCircle2, Sunrise, Sun, Moon, Cookie, Settings, Trash2 } from 'lucide-react';
import { searchFoodInDatabase, suggestFoodsFromDatabase } from './lib/firebase';
import { analyzeFoodText, analyzeFoodImage, NutritionalInfo } from './lib/gemini';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface LoggedFood extends NutritionalInfo {
  id: string; // unique daily id
}

interface Diary {
  breakfast: LoggedFood[];
  lunch: LoggedFood[];
  dinner: LoggedFood[];
  snack: LoggedFood[];
}

const meallabels: Record<MealType, { title: string; icon: any; bg: string; color: string; border: string }> = {
  breakfast: { title: '早餐', icon: Sunrise, bg: 'bg-green-50', color: 'text-green-600', border: 'border-green-100' },
  lunch: { title: '午餐', icon: Sun, bg: 'bg-yellow-50', color: 'text-yellow-600', border: 'border-yellow-100' },
  dinner: { title: '晚餐', icon: Moon, bg: 'bg-indigo-50', color: 'text-indigo-600', border: 'border-indigo-100' },
  snack: { title: '小食', icon: Cookie, bg: 'bg-pink-50', color: 'text-pink-600', border: 'border-pink-100' }
};

export default function App() {
  const [activeView, setActiveView] = useState<'home' | 'diary' | 'search' | 'camera' | 'mealDetail'>('home');
  const [previousView, setPreviousView] = useState<'home' | 'diary' | 'search' | 'mealDetail'>('home');
  const [targetMeal, setTargetMeal] = useState<MealType | null>(null);

  // Diary State
  const [diary, setDiary] = useState<Diary>({
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: []
  });

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<NutritionalInfo | null>(null);
  const [source, setSource] = useState<'firebase' | 'ai' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const isFirebaseConfigured = !!((import.meta as any).env?.VITE_FIREBASE_PROJECT_ID);

  const [dailyGoal, setDailyGoal] = useState<number>(2000);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [newGoalInput, setNewGoalInput] = useState(dailyGoal.toString());
  const [isSummarized, setIsSummarized] = useState(false);

  useEffect(() => {
    setIsSummarized(false);
  }, [diary, dailyGoal]);
  
  // Calculate today's totals
  let todayCalories = 0;
  Object.values(diary).forEach((meals) => {
    (meals as LoggedFood[]).forEach((item) => {
      todayCalories += (item.calories_kcal ?? item.calories ?? 0);
    });
  });
  const isUnderGoal = todayCalories <= dailyGoal;

  // Generate current week view
  const daysOfWeek = ['一', '二', '三', '四', '五', '六', '日'];
  const todayIndex = (new Date().getDay() + 6) % 7; // 0 for Monday (一), 6 for Sunday (日)

  // Global Search State
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [isGlobalSearchFocused, setIsGlobalSearchFocused] = useState(false);
  // Term Suggestions State
  const [dbSuggestions, setDbSuggestions] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Generalize suggestion hook/effect for whatever is currently focused (or just both)
  useEffect(() => {
    const activeTerm = activeView === 'search' ? searchTerm.trim() : globalSearchTerm.trim();
    if (!activeTerm) {
      setDbSuggestions([]);
      return;
    }
    const fetchSugg = async () => {
      const results = await suggestFoodsFromDatabase(activeTerm);
      setDbSuggestions(results);
    };
    const debounceId = setTimeout(fetchSugg, 300);
    return () => clearTimeout(debounceId);
  }, [globalSearchTerm, searchTerm, activeView]);

  const MOCK_KEYWORDS = ['蘋果', '蘋果批', '香蕉', '叉燒包', '菠菜餃', '燒賣', '蝦餃', '牛肉麵', '珍珠奶茶', '菠蘿包', '蛋撻', '三文治', '沙律', '咖啡'];
  const localFilteredKeywords = activeView === 'search'
    ? (searchTerm.trim() ? MOCK_KEYWORDS.filter(k => k.includes(searchTerm.trim())) : [])
    : (globalSearchTerm.trim() ? MOCK_KEYWORDS.filter(k => k.includes(globalSearchTerm.trim())) : []);
    
  // Combine unique suggestions
  const filteredKeywords = Array.from(new Set([...dbSuggestions, ...localFilteredKeywords])).slice(0, 8);

  const executeSearch = async (term: string) => {
    if (!term.trim()) return;

    setIsSearching(true);
    setResult(null);
    setError(null);
    setSource(null);

    try {
      let data = await searchFoodInDatabase(term);
      if (data) {
        setResult(data as NutritionalInfo);
        setSource('firebase');
      } else {
        data = await analyzeFoodText(term);
        if (data) {
          setResult(data);
          setSource('ai');
        } else {
          setError("找不到這食物的資料。(Could not find data for this food)");
        }
      }
    } catch (err: any) {
      setError(err.message || "發生錯誤 (An error occurred)");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchText = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await executeSearch(searchTerm.trim());
  };

  const handleGlobalSearchSelect = (term: string) => {
    if (!term.trim()) return;
    setGlobalSearchTerm('');
    setIsGlobalSearchFocused(false);
    setSearchTerm(term);
    setPreviousView('diary');
    setActiveView('search');
    setTargetMeal(null);
    executeSearch(term);
  };

  const startCamera = async () => {
    setPreviousView(activeView);
    setActiveView('camera');
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError('相機權限遭拒，或沒有找到可用的相機。');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const closeCamera = () => {
    stopCamera();
    setActiveView(previousView);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(async (blob) => {
          if (blob) {
            stopCamera();
            const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
            
            setIsSearching(true);
            setResult(null);
            setError(null);
            setActiveView('search');

            const reader = new FileReader();
            reader.onloadend = async () => {
              try {
                const base64Image = reader.result as string;
                const result = await analyzeFoodImage(base64Image, file.type);
                setResult(result);
                setSource('ai');
              } catch (err: any) {
                setError(err.message || '分析圖片失敗，請重試。');
              } finally {
                setIsSearching(false);
              }
            };
            reader.readAsDataURL(file);
          }
        }, 'image/jpeg');
      }
    }
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSearching(true);
    setResult(null);
    setError(null);
    setSource(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result as string;
        const mimeType = file.type;
        const data = await analyzeFoodImage(base64Image, mimeType);
        if (data) {
          setResult(data);
          setSource('ai');
        } else {
          setError("無法辨識食物。(Could not identify the food)");
        }
        setIsSearching(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || "圖片處理錯誤 (Image processing error)");
      setIsSearching(false);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addFoodToMeal = () => {
    if (!targetMeal || !result) return;
    
    const newFood: LoggedFood = {
      ...result,
      id: Math.random().toString(36).substring(7)
    };

    setDiary(prev => ({
      ...prev,
      [targetMeal]: [...prev[targetMeal], newFood]
    }));

    // Reset Search state & go back
    setResult(null);
    setSearchTerm('');
    if (previousView === 'mealDetail' && targetMeal) {
      setActiveView('mealDetail');
    } else {
      setActiveView('diary');
    }
  };

  const openSearch = (meal: MealType) => {
    setTargetMeal(meal);
    setPreviousView('diary');
    setActiveView('search');
    setResult(null);
    setSearchTerm('');
    setError(null);
  };

  const closeSearch = () => {
    setActiveView(previousView);
    if (previousView !== 'mealDetail') {
      setTargetMeal(null);
    }
  };

  const renderHomeView = () => (
    <div className="flex-1 flex flex-col items-center justify-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="w-full max-w-sm mx-auto flex flex-col items-center">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-gray-800 mb-3 tracking-tight">SLIMCC<span className="text-green-500">.</span></h1>
        </div>

        <div className="w-full flex flex-row justify-center gap-5 my-6">
          <button
            onClick={() => {
              setTargetMeal(null);
              setPreviousView('home');
              setActiveView('search');
            }}
            className="w-40 h-40 bg-white border-4 border-green-500 text-green-600 rounded-full shadow-sm hover:bg-green-50 transition-all flex flex-col items-center justify-center gap-3 group shrink-0"
          >
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Search className="w-7 h-7 text-green-600" />
            </div>
            <span className="text-lg font-black">搜尋食物</span>
          </button>

          <button
            onClick={() => {
              setTargetMeal(null);
              startCamera();
            }}
            className="w-40 h-40 bg-green-500 text-white rounded-full shadow-lg shadow-green-200 hover:bg-green-600 transition-all flex flex-col items-center justify-center gap-3 group shrink-0"
          >
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Camera className="w-7 h-7 text-white" />
            </div>
            <span className="text-lg font-black">相機</span>
          </button>
        </div>

        <button
          onClick={() => setActiveView('diary')}
          className="mt-10 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full font-bold text-sm transition-colors flex items-center gap-2"
        >
          查看我的紀錄 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderDiaryView = () => (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300 flex flex-col h-full overflow-hidden">
      
      {/* Global Search Bar Overlay Wrapper */}
      <div className="relative z-20 mb-3 mx-1">
        <div className="relative flex items-center bg-white border border-gray-100 rounded-2xl px-4 py-2.5 shadow-sm focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100 transition-all">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="搜尋食物..."
            value={globalSearchTerm}
            onChange={(e) => setGlobalSearchTerm(e.target.value)}
            onFocus={() => setIsGlobalSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsGlobalSearchFocused(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                 handleGlobalSearchSelect(globalSearchTerm);
                 (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-[15px] font-medium text-gray-800 placeholder:text-gray-400 ml-3"
          />
        </div>

        {/* Dropdown Suggestions */}
        {isGlobalSearchFocused && globalSearchTerm.trim() && (
          <div className="absolute top-[110%] left-0 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-30">
            {filteredKeywords.length > 0 ? (
              <div className="max-h-60 overflow-y-auto p-2">
                {filteredKeywords.map(kw => (
                  <button
                    key={kw}
                    onMouseDown={(e) => e.preventDefault()} // prevent blur
                    onClick={() => handleGlobalSearchSelect(kw)}
                    className="w-full text-left px-4 py-3 hover:bg-green-50 text-gray-800 text-[15px] font-bold rounded-xl transition-colors flex items-center gap-3"
                  >
                    <Search className="w-4 h-4 text-gray-400" />
                    {kw}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-4 text-center text-sm font-bold text-gray-400">
                按 Enter 搜尋 "{globalSearchTerm}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Diary Content (Fades when search is focused) */}
      <div className={`transition-opacity duration-300 flex-1 flex flex-col overflow-hidden ${isGlobalSearchFocused ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
        {/* Weekly Strip */}
      <div className="bg-white rounded-[16px] p-2 shadow-sm border border-gray-100 mb-2 mx-1 shrink-0">
        <h2 className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest text-center">熱量達標</h2>
        <div className="flex justify-between items-center px-1">
          {daysOfWeek.map((dayLabel, i) => {
            if (i === todayIndex) {
              return (
                <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${isSummarized ? (isUnderGoal ? 'border-green-500 bg-green-50 text-green-600' : 'border-red-500 bg-red-50 text-red-600') : 'border-gray-900 bg-white text-gray-900'} ${isSummarized && isUnderGoal ? 'shadow-md shadow-green-100' : isSummarized && !isUnderGoal ? 'shadow-md shadow-red-100' : ''}`}>
                    {isSummarized && isUnderGoal ? <Award className="w-4 h-4" /> : isSummarized && !isUnderGoal ? <FileWarning className="w-4 h-4" /> : <span className="text-xs font-black">{dayLabel}</span>}
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-gray-100 text-gray-300">
                  <span className="text-[10px] font-bold">{dayLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Summary */}
      <div className="bg-gray-900 text-white rounded-[20px] p-3 mb-2 shadow-xl mx-1 shrink-0">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-gray-400 text-[10px] font-bold uppercase mb-0.5 tracking-widest">今日吸收熱量</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black leading-none">{todayCalories}</span>
              <span className="text-gray-400 text-xs font-medium">/ {dailyGoal}</span>
            </div>
          </div>
          <button onClick={() => { setNewGoalInput(dailyGoal.toString()); setShowSettingsDialog(true); }}>
            <Settings className="w-5 h-5 mb-0.5 text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>
        
        {/* Progress bar */}
        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${todayCalories > dailyGoal ? 'bg-orange-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min((todayCalories / dailyGoal) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Meals List */}
      <div className="flex flex-col gap-2 mx-1 flex-1 overflow-y-auto pb-1 min-h-0">
        {(Object.keys(meallabels) as MealType[]).map((mealKey) => {
          const config = meallabels[mealKey];
          const Icon = config.icon;
          const foods = diary[mealKey];
          const totalMealCals = foods.reduce((sum, item) => sum + (item.calories_kcal ?? item.calories ?? 0), 0);

          return (
            <button key={mealKey} onClick={() => { setTargetMeal(mealKey); setActiveView('mealDetail'); }} className={`w-full text-left bg-white border ${config.border} rounded-[16px] p-2 shadow-sm transition-transform active:scale-[0.98] hover:bg-gray-50 shrink-0 flex flex-col`}>
              <div className="flex justify-between items-center text-sm w-full">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${config.bg} ${config.color} flex items-center justify-center shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-[14px] leading-tight">{config.title}</h3>
                    <p className="text-[11px] text-gray-500 font-medium">{totalMealCals} kcal</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {foods.length > 0 && (
                <div className="mt-2 pl-12 pr-2 space-y-1 border-t border-gray-50 pt-2 w-full">
                  {foods.map(food => (
                    <div key={food.id} className="flex justify-between items-center text-xs">
                      <span className="font-medium text-gray-600 truncate mr-3">{food.name || '未知食物'}</span>
                      <span className="font-bold text-gray-400 shrink-0">{food.calories_kcal ?? food.calories ?? 0} <span className="font-medium text-[9px]">kcal</span></span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-1 mt-2 mb-2 shrink-0">
        <button
          onClick={() => setIsSummarized(true)}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold text-sm rounded-[16px] shadow-sm transition-transform active:scale-[0.98] shrink-0"
        >
          統計今日熱量
        </button>
      </div>
      </div>
    </div>
  );

  const renderSearchView = () => (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 mb-4 mx-1 mt-1 shrink-0">
        <button onClick={closeSearch} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-800 shadow-sm border border-gray-100 shrink-0">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-black text-gray-800 truncate">
          {targetMeal ? (
            <>添加至 <span className={meallabels[targetMeal].color}>{meallabels[targetMeal].title}</span></>
          ) : (
            '搜尋紀錄'
          )}
        </h2>
      </div>

      <div className="space-y-3 mb-4 mx-1 shrink-0 relative">
        <form onSubmit={handleSearchText} className="flex gap-2">
          <div className="flex-1 bg-white border border-green-50 rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-sm">
            <Search className="w-5 h-5 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="輸入食物名稱..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setResult(null);
                setError(null);
              }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-[15px] font-medium text-gray-800 placeholder:text-gray-400"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchTerm.trim()}
            className="w-[48px] h-[48px] shrink-0 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-green-200 disabled:opacity-50 transition-colors hover:bg-green-600"
          >
            <Search className="w-5 h-5" />
          </button>
        </form>

        {/* Search View Dropdown Suggestions */}
        {isSearchFocused && searchTerm.trim() && !isSearching && !result && (
          <div className="absolute top-[56px] left-0 right-[56px] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-30">
            {filteredKeywords.length > 0 ? (
              <div className="max-h-60 overflow-y-auto p-2">
                {filteredKeywords.map(kw => (
                  <button
                    key={kw}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()} // prevent blur
                    onClick={() => {
                      setSearchTerm(kw);
                      setIsSearchFocused(false);
                      executeSearch(kw);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-green-50 text-gray-800 text-[15px] font-bold rounded-xl transition-colors flex items-center gap-3"
                  >
                    <Search className="w-4 h-4 text-gray-400" />
                    {kw}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-4 text-center text-sm font-bold text-gray-400">
                按 Enter 搜尋 "{searchTerm}"
              </div>
            )}
          </div>
        )}

        <div className="relative flex items-center justify-center my-3">
          <div className="border-t border-gray-200 w-full"></div>
          <span className="bg-[#F2FBF4] px-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">OR</span>
          <div className="border-t border-gray-200 w-full"></div>
        </div>

        <button
          onClick={() => startCamera()}
          disabled={isSearching}
          className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-[15px] rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <Camera className="w-5 h-5" />
          <span>相機</span>
        </button>
      </div>

      {isSearching && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-green-100 border-t-green-500"></div>
          <p className="mt-3 text-green-600 text-[13px] font-bold animate-pulse">正在處理中... (Processing...)</p>
        </div>
      )}

      {error && (
        <div className="mb-4 mx-1 bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-[13px] text-center font-medium">
          {error}
        </div>
      )}

      {result && !isSearching && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 overflow-y-auto pb-4 mx-1">
          <div className="bg-white border-2 border-green-500 rounded-[28px] p-4 mb-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-bold text-[18px] text-gray-800 leading-tight">{result.name || '未知食物'}</h3>
                  <span className={`px-2 py-0.5 text-[9px] rounded-full font-bold uppercase tracking-wider ${
                    source === 'firebase'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-green-100 text-green-600'
                  }`}>
                    {source === 'firebase' ? 'Firebase' : 'AI'}
                  </span>
                </div>
                {(result.category || result.description) && (
                  <p className="text-gray-500 text-[12px] leading-relaxed mt-1 line-clamp-2">{result.category || result.description}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-6">
            <div className="bg-orange-50 p-3.5 rounded-[20px] border border-orange-100 flex flex-col justify-between">
              <p className="text-orange-600 text-[10px] font-bold uppercase mb-1.5 flex items-center gap-1"><Flame className="w-3 h-3"/> 熱量</p>
              <p className="text-2xl font-black text-orange-900 tracking-tight">{result.calories_kcal ?? result.calories ?? '-'} <span className="text-xs font-normal text-orange-700/80">kcal</span></p>
            </div>
            <div className="bg-blue-50 p-3.5 rounded-[20px] border border-blue-100 flex flex-col justify-between">
              <p className="text-blue-600 text-[10px] font-bold uppercase mb-1.5 flex items-center gap-1"><Droplet className="w-3 h-3"/> 蛋白質</p>
              <p className="text-2xl font-black text-blue-900 tracking-tight">{result.protein_g ?? result.protein ?? '-'} <span className="text-xs font-normal text-blue-700/80">g</span></p>
            </div>
          </div>

          {targetMeal ? (
            <button 
              onClick={addFoodToMeal}
              className="w-full py-3.5 bg-green-500 text-white font-bold text-[15px] rounded-2xl shadow-md shadow-green-200 hover:bg-green-600 transition-colors"
            >
              確認加入 {meallabels[targetMeal].title}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-widest">請選擇要加入的時段</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(meallabels) as MealType[]).map(meal => (
                  <button 
                    key={meal}
                    onClick={() => {
                      const newFood: LoggedFood = { ...result, id: Math.random().toString(36).substring(7) };
                      setDiary(prev => ({ ...prev, [meal]: [...prev[meal], newFood] }));
                      setResult(null);
                      setSearchTerm('');
                      setActiveView('diary');
                    }}
                    className={`py-3 rounded-[16px] font-bold text-[14px] flex items-center justify-center gap-2 border-2 ${meallabels[meal].border} ${meallabels[meal].color} ${meallabels[meal].bg} hover:brightness-95 transition-all shadow-sm`}
                  >
                    {meallabels[meal].title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderCameraView = () => (
    <div className="absolute inset-0 z-50 bg-black flex flex-col pt-12 pb-8">
      <div className="px-4 flex justify-between items-center z-10 mb-4 h-12">
        <button onClick={closeCamera} className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white">
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 relative bg-gray-900 overflow-hidden mt-4">
        <video 
          ref={videoRef} 
          playsInline 
          muted 
          className="w-full h-full object-cover"
        />
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
             <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">
               {cameraError}
             </div>
          </div>
        )}
      </div>

      <div className="h-32 flex items-center justify-center shrink-0">
        <button 
          onClick={capturePhoto}
          className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-gray-200"
        >
          <div className="w-16 h-16 rounded-full border-2 border-black"></div>
        </button>
      </div>
      
      {/* Hidden canvas for taking pictures */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );

  const updateFoodCalories = (mealKey: MealType, foodId: string, newCalories: number) => {
    setDiary(prev => ({
      ...prev,
      [mealKey]: prev[mealKey].map(food => 
        food.id === foodId ? { ...food, calories_kcal: newCalories, calories: newCalories } : food
      )
    }));
  };

  const removeFood = (mealKey: MealType, foodId: string) => {
    setDiary(prev => ({
      ...prev,
      [mealKey]: prev[mealKey].filter(food => food.id !== foodId)
    }));
  };

  const renderMealDetailView = () => {
    if (!targetMeal) return null;
    const config = meallabels[targetMeal];
    const foods = diary[targetMeal];
    const totalMealCals = foods.reduce((sum, item) => sum + (item.calories_kcal ?? item.calories ?? 0), 0);

    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-3 mb-4 mx-1 mt-1 shrink-0">
          <button onClick={() => { setActiveView('diary'); setTargetMeal(null); }} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-800 shadow-sm border border-gray-100 shrink-0 hover:bg-gray-50 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className={`w-10 h-10 rounded-xl ${config.bg} ${config.color} flex items-center justify-center shrink-0`}>
            <config.icon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-800 leading-tight">{config.title}</h2>
            <p className="text-xs text-gray-500 font-medium">{totalMealCals} kcal</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-1 space-y-3 pb-8">
          {foods.length > 0 ? (
             foods.map(food => (
              <div key={food.id} className="bg-white rounded-[16px] p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-gray-800 text-[15px]">{food.name || '未知食物'}</span>
                  <button 
                    onClick={() => removeFood(targetMeal, food.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors shrink-0 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                  <input 
                    type="number"
                    value={food.calories_kcal ?? food.calories ?? 0}
                    onChange={(e) => updateFoodCalories(targetMeal, food.id, parseInt(e.target.value) || 0)}
                    className="bg-transparent border-none focus:ring-0 focus:outline-none text-xl font-black text-gray-800 w-full p-0 flex-1 leading-none h-6"
                  />
                  <span className="text-xs font-bold text-gray-400 shrink-0 uppercase tracking-wider mt-1">kcal</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 opacity-50">
              <p className="text-sm font-bold text-gray-400 mb-4">目前沒有任何食物</p>
            </div>
          )}
        </div>
        
        <div className="px-1 mt-2 mb-2 shrink-0 grid grid-cols-2 gap-3">
           <button 
              onClick={() => {
                setPreviousView('mealDetail');
                setActiveView('search');
              }}
              className="w-full py-4 border-2 border-dashed border-green-300 text-green-600 rounded-[16px] hover:bg-green-50 hover:border-green-400 transition-colors font-bold text-sm flex items-center justify-center gap-2"
            >
              <Search className="w-5 h-5" />
              搜尋食物
            </button>
            <button 
              onClick={() => {
                startCamera();
              }}
              className="w-full py-4 border-2 border-dashed border-blue-300 text-blue-600 rounded-[16px] hover:bg-blue-50 hover:border-blue-400 transition-colors font-bold text-sm flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              相機
            </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[100dvh] bg-[#F2FBF4] text-gray-800 font-sans relative overflow-hidden flex flex-col">
      {activeView === 'camera' && renderCameraView()}
      <main className={`max-w-md w-full mx-auto px-3 pt-4 flex-1 flex flex-col overflow-hidden pb-4 ${activeView === 'camera' ? 'hidden' : ''}`}>
        
        {/* Header (Only show on diary view for clean UI) */}
        {activeView === 'diary' && (
          <div className="flex items-center justify-between mb-4 px-1 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveView('home')} className="w-9 h-9 flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-black text-gray-800">SLIMCC<span className="text-green-500">.</span></h1>
            </div>
            <button 
              onClick={() => setDiary({ breakfast: [], lunch: [], dinner: [], snack: [] })}
              className="w-9 h-9 flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-100 text-gray-400 hover:text-red-500 transition-colors"
              title="清空紀錄"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {!isFirebaseConfigured && activeView === 'diary' && (
          <div className="bg-white border-2 border-yellow-400 p-3 rounded-2xl mb-4 flex items-start gap-3 shadow-sm mx-1 shrink-0">
            <FileWarning className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
            <div className="text-xs text-gray-600">
              <p className="font-bold text-gray-800">尚未設定 Firebase</p>
              <p className="mt-1">請加入環境變數。目前只能使用 AI 辨識功能。</p>
            </div>
          </div>
        )}

        {activeView === 'home' ? renderHomeView() : 
         activeView === 'diary' ? renderDiaryView() : 
         activeView === 'mealDetail' ? renderMealDetailView() : renderSearchView()}
      </main>

      {showSettingsDialog && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-black text-gray-800 mb-4">設定每日目標熱量</h3>
            
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">每日目標卡路里 (kcal)</label>
              <input 
                type="number" 
                value={newGoalInput}
                onChange={(e) => setNewGoalInput(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-medium focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowSettingsDialog(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  const goal = parseInt(newGoalInput);
                  if (!isNaN(goal) && goal > 0) {
                    setDailyGoal(goal);
                    setShowSettingsDialog(false);
                  }
                }}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl transition-colors shadow-sm"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
