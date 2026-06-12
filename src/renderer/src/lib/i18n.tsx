import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type Lang = 'en' | 'lv'

const STORAGE_KEY = 'agent0_language'

export function getLang(): Lang {
  return (localStorage.getItem(STORAGE_KEY) as Lang) || 'en'
}

export function setLangStorage(lang: Lang): Lang {
  localStorage.setItem(STORAGE_KEY, lang)
  return lang
}

interface LangContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string, vars?: Record<string, string>) => string
}

const LangContext = createContext<LangContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key: string) => key
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLang())

  const setLang = useCallback((newLang: Lang) => {
    setLangStorage(newLang)
    setLangState(newLang)
  }, [])

  const translate = useCallback((key: string, vars?: Record<string, string>) => {
    let text = dicts[lang][key] || dicts['en'][key] || key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{{${k}}}`, v)
      }
    }
    return text
  }, [lang])

  return (
    <LangContext.Provider value={{ lang, setLang, t: translate }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LangContext)
}

type Dict = Record<string, string>

const en: Dict = {
  // App
  'app.title': 'Agent0',
  'app.settings': 'Settings',
  'app.hero.title': 'What can I help you with?',
  'app.hero.desc': 'I can write, research, summarize, brainstorm, and more — using the best AI model for each task.',
  'app.placeholder': 'Type a message...',
  'app.newChat': 'New chat',
  'app.messages': 'messages',
  'app.copy': 'Copy',
  'app.code': 'code',
  'app.thinking': 'Thinking...',

  // Suggestions
  'suggest.trip': 'Plan a weekend trip',
  'suggest.email': 'Draft a professional email',
  'suggest.summarize': 'Summarize a long document',
  'suggest.research': 'Research a topic for me',
  'suggest.explain': 'Help me understand something',
  'suggest.brainstorm': 'Brainstorm creative ideas',

  // Welcome
  'welcome': "Hi! I'm Agent0. I can help you with coding, research, and tasks using multiple AI models. What would you like to do?",

  // Settings
  'settings.title': 'Settings',
  'settings.desc': 'Configure AI providers, models, and API keys',
  'settings.tab.models': 'Models',
  'settings.tab.keys': 'API Keys',
  'settings.tab.local': 'Local Setup',
  'settings.tab.about': 'About',
  'settings.activeProvider': 'Active Provider',
  'settings.activeModel': 'Active Model',
  'settings.smartRouting': 'Smart Routing',
  'settings.smartRoutingDesc': 'Auto-select best model for each task',
  'settings.availableProviders': 'Available Providers',
  'settings.getKey': 'Get key',
  'settings.getToken': 'Get token',
  'settings.modelsCount': 'models',
  'settings.ready': 'Ready',
  'settings.disconnected': 'Disconnected',
  'settings.noKey': 'No Key',
  'settings.error': 'Error',
  'settings.requiresKey': 'Requires Key',
  'settings.about.version': 'Agent0 v0.1.0',
  'settings.about.desc': 'An AI agent desktop app that routes tasks to the best model across multiple providers.',
  'settings.about.providers': 'Free providers: Ollama (local), Gemini (Google), Groq, Hugging Face',
  'settings.about.troubleshooting': 'Troubleshooting API Keys',
  'settings.about.geminiHelp': 'If https://aistudio.google.com/apikey gives an error, try creating the key from Google Cloud Console instead:',
  'settings.about.privacy': 'Your API keys are stored locally and never sent anywhere except to the provider\'s API.',
  'settings.geminiPlaceholder': 'Paste your Gemini API key...',
  'settings.groqPlaceholder': 'Paste your Groq API key...',
  'settings.hfPlaceholder': 'Paste your Hugging Face token...',
  'settings.geminiRate': 'Free tier: 60 requests per minute',
  'settings.groqRate': 'Free tier: rate limited, generous free credits',
  'settings.hfRate': 'Free inference API, no credit card needed',
  'settings.unavailable': '(unavailable)',

  // Local setup
  'local.title': 'Local AI Setup',
  'local.status': 'Status',
  'local.model': 'Model',
  'local.install': 'One-Click Install Ollama',
  'local.pullOnly': 'Pull Model Only',
  'local.retry': 'Retry',
  'local.waiting': 'Please wait, this may take a few minutes...',
  'local.ready': 'Ollama is ready',
  'local.readyDesc': 'is installed and running locally. All processing is free and offline.',
  'local.checking': 'Checking Ollama...',
  'local.running': 'Ollama is running',
  'local.installedNotRunning': 'Ollama installed but not running',
  'local.notInstalled': 'Ollama is not installed',
  'local.checkFailed': 'Could not check Ollama status',
  'local.startDownload': 'Starting download...',
  'local.downloadFailed': 'Download failed',
  'local.installFailed': 'Install failed',
  'local.modelPullFailed': 'Model pull failed',
  'local.installedNotRunningHint': 'Ollama is installed but not running. Start it from the Start Menu or run',
  'local.inTerminal': 'in a terminal.',
  'local.linuxHint': 'On Linux, please install Ollama via: curl -fsSL https://ollama.ai/install.sh | sh. Then restart this app.',
  'local.step1': 'Downloading Ollama installer',
  'local.step2': 'Installing Ollama',
  'local.step3': 'Downloading AI model',
  'local.step1desc': 'Downloading the Ollama installer (~300 MB). Speed depends on your connection.',
  'local.step2desc': 'Running silent installer. This can take 1-2 minutes with no visible window.',
  'local.step3desc': 'Downloading the {{model}} AI model ({{size}}). This is the largest step.',

  // Tool events
  'tool.running': 'Running',
  'tool.completed': 'Completed',
  'tool.failed': 'Failed',
  'tool.input': 'Input',
  'tool.result': 'Result',

  // System prompt
  'system.prompt': `You are Agent0, an AI assistant running on Windows. You have access to tools: read_file, write_file, edit_file, list_files, bash, web_fetch. Use them when needed. Be helpful, concise, and honest.`,

  // Agent
  'agent.noModels': 'No AI models are available.',
  'agent.ollamaHint': 'Install Ollama from https://ollama.ai, run: ollama pull llama3.2, restart this app.',
  'agent.keyHint': 'Go to Settings > API Keys and add a key for Gemini or Groq.',
  'agent.fallback': 'Previously selected model "{{model}}" is not available. Falling back to **{{fallback}}**.',
  'agent.tryingOthers': 'Still trying other models...',
  'agent.routing': 'Routing to **{{task}}**: {{provider}}/{{model}}',
  'agent.providerNotFound': 'Provider "{{provider}}" not found. Check your Settings.',
  'agent.error': 'Agent error: {{message}}',

  // Providers
  'provider.ollama': 'Ollama',
  'provider.gemini': 'Google Gemini',
  'provider.groq': 'Groq',
  'provider.huggingface': 'Hugging Face',
}

const lv: Dict = {
  // App
  'app.title': 'Agent0',
  'app.settings': 'Iestatījumi',
  'app.hero.title': 'Kā es varu palīdzēt?',
  'app.hero.desc': 'Es varu rakstīt, pētīt, apkopot, ideju vētru un vēl — izmantojot labāko AI modeli katram uzdevumam.',
  'app.placeholder': 'Raksti ziņu...',
  'app.newChat': 'Jauna saruna',
  'app.messages': 'ziņas',
  'app.copy': 'Kopēt',
  'app.code': 'kods',
  'app.thinking': 'Domā...',

  // Suggestions
  'suggest.trip': 'Izplāno nedēļas nogales ceļojumu',
  'suggest.email': 'Uzraksti profesionālu e-pastu',
  'suggest.summarize': 'Apkopo garu dokumentu',
  'suggest.research': 'Izpēti man kādu tēmu',
  'suggest.explain': 'Palīdzi man kaut ko saprast',
  'suggest.brainstorm': 'Ideju vētras radošām idejām',

  // Welcome
  'welcome': 'Sveiks! Es esmu Agent0. Es varu palīdzēt ar programmēšanu, pētniecību un uzdevumiem, izmantojot vairākus AI modeļus. Ar ko vēlies sākt?',

  // Settings
  'settings.title': 'Iestatījumi',
  'settings.desc': 'Konfigurē AI nodrošinātājus, modeļus un API atslēgas',
  'settings.tab.models': 'Modeļi',
  'settings.tab.keys': 'API Atslēgas',
  'settings.tab.local': 'Lokāli',
  'settings.tab.about': 'Par',
  'settings.activeProvider': 'Aktīvais nodrošinātājs',
  'settings.activeModel': 'Aktīvais modelis',
  'settings.smartRouting': 'Viedā maršrutēšana',
  'settings.smartRoutingDesc': 'Automātiski izvēlies labāko modeli katram uzdevumam',
  'settings.availableProviders': 'Pieejamie nodrošinātāji',
  'settings.getKey': 'Iegūt atslēgu',
  'settings.getToken': 'Iegūt tokenu',
  'settings.modelsCount': 'modeļi',
  'settings.ready': 'Gatavs',
  'settings.disconnected': 'Atvienots',
  'settings.noKey': 'Nav atslēgas',
  'settings.error': 'Kļūda',
  'settings.requiresKey': 'Nepieciešama atslēga',
  'settings.about.version': 'Agent0 v0.1.0',
  'settings.about.desc': 'AI aģenta darbvirsmas lietotne, kas maršrutē uzdevumus uz labāko modeli starp vairākiem nodrošinātājiem.',
  'settings.about.providers': 'Bezmaksas nodrošinātāji: Ollama (lokāli), Gemini (Google), Groq, Hugging Face',
  'settings.about.troubleshooting': 'API atslēgu problēmu risināšana',
  'settings.about.geminiHelp': 'Ja https://aistudio.google.com/apikey rāda kļūdu, mēģiniet izveidot atslēgu no Google Cloud Console:',
  'settings.about.privacy': 'Jūsu API atslēgas tiek glabātas lokāli un nekad netiek sūtītas nekur, izņemot uz pakalpojumu sniedzēja API.',
  'settings.geminiPlaceholder': 'Ielīmējiet Gemini API atslēgu...',
  'settings.groqPlaceholder': 'Ielīmējiet Groq API atslēgu...',
  'settings.hfPlaceholder': 'Ielīmējiet Hugging Face tokenu...',
  'settings.geminiRate': 'Bezmaksas līmenis: 60 pieprasījumi minūtē',
  'settings.groqRate': 'Bezmaksas līmenis: ierobežots, dāsni bezmaksas kredīti',
  'settings.hfRate': 'Bezmaksas izsecināšanas API, nav nepieciešama kredītkarte',
  'settings.unavailable': '(nav pieejams)',

  // Local setup
  'local.title': 'Lokālā AI Iestatīšana',
  'local.status': 'Statuss',
  'local.model': 'Modelis',
  'local.install': 'Viena klikšķa Ollama instalācija',
  'local.pullOnly': 'Tikai lejupielādēt modeli',
  'local.retry': 'Mēģināt vēlreiz',
  'local.waiting': 'Lūdzu uzgaidiet, tas var aizņemt dažas minūtes...',
  'local.ready': 'Ollama ir gatavs',
  'local.readyDesc': 'ir instalēts un darbojas lokāli. Visa apstrāde ir bezmaksas un bezsaistē.',
  'local.checking': 'Pārbauda Ollama...',
  'local.running': 'Ollama darbojas',
  'local.installedNotRunning': 'Ollama instalēts, bet nedarbojas',
  'local.notInstalled': 'Ollama nav instalēts',
  'local.checkFailed': 'Nevarēja pārbaudīt Ollama statusu',
  'local.startDownload': 'Sāk lejupielādi...',
  'local.downloadFailed': 'Lejupielāde neizdevās',
  'local.installFailed': 'Instalācija neizdevās',
  'local.modelPullFailed': 'Modeļa lejupielāde neizdevās',
  'local.installedNotRunningHint': 'Ollama ir instalēts, bet nedarbojas. Palaidiet to no Start izvēlnes vai terminālī ar',
  'local.inTerminal': '.',
  'local.linuxHint': 'Uz Linux, lūdzu, instalējiet Ollama ar: curl -fsSL https://ollama.ai/install.sh | sh. Tad pārstartējiet šo lietotni.',
  'local.step1': 'Lejupielādē Ollama instalētāju',
  'local.step2': 'Instalē Ollama',
  'local.step3': 'Lejupielādē AI modeli',
  'local.step1desc': 'Lejupielādē Ollama instalētāju (~300 MB). Ātrums atkarīgs no jūsu interneta savienojuma.',
  'local.step2desc': 'Palaiž kluso instalētāju. Tas var aizņemt 1-2 minūtes bez redzama loga.',
  'local.step3desc': 'Lejupielādē {{model}} AI modeli ({{size}}). Šis ir lielākais solis.',

  // Tool events
  'tool.running': 'Izpilda',
  'tool.completed': 'Pabeigts',
  'tool.failed': 'Neizdevās',
  'tool.input': 'Ievade',
  'tool.result': 'Rezultāts',

  // System prompt
  'system.prompt': `Tu esi Agent0, AI asistents uz Windows. Tev ir piekļuve rīkiem: read_file, write_file, edit_file, list_files, bash, web_fetch. Izmanto tos, kad vajag. Esi izpalīdzīgs, kodolīgs un godīgs. Atbildi tajā pašā valodā, kurā lietotājs raksta.`,

  // Agent
  'agent.noModels': 'Nav pieejami AI modeļi.',
  'agent.ollamaHint': 'Instalē Ollama no https://ollama.ai, palaid: ollama pull llama3.2, pārstartē šo lietotni.',
  'agent.keyHint': 'Dodies uz Iestatījumi > API Atslēgas un pievieno atslēgu priekš Gemini vai Groq.',
  'agent.fallback': 'Iepriekš izvēlētais modelis "{{model}}" nav pieejams. Pārslēdzos uz **{{fallback}}**.',
  'agent.tryingOthers': 'Joprojām mēģinu citus modeļus...',
  'agent.routing': 'Maršrutē uz **{{task}}**: {{provider}}/{{model}}',
  'agent.providerNotFound': 'Nodrošinātājs "{{provider}}" nav atrasts. Pārbaudi Iestatījumus.',
  'agent.error': 'Aģenta kļūda: {{message}}',

  // Providers
  'provider.ollama': 'Ollama',
  'provider.gemini': 'Google Gemini',
  'provider.groq': 'Groq',
  'provider.huggingface': 'Hugging Face',
}

const dicts: Record<Lang, Dict> = { en, lv }

export function t(key: string, vars?: Record<string, string>): string {
  const lang = getLang()
  let text = dicts[lang][key] || dicts['en'][key] || key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{{${k}}}`, v)
    }
  }
  return text
}
