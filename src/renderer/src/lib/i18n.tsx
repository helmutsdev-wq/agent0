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
  'app.title': 'Agent O',
  'app.settings': 'Settings',
  'app.hero.title': 'What can I help you with?',
  'app.hero.desc': 'I can write, research, summarize, brainstorm, and more — using the best AI model for each task.',
  'app.placeholder': 'Type a message...',
  'app.newChat': 'New chat',
  'app.messages': 'messages',
  'app.copy': 'Copy',
  'app.code': 'code',
  'app.thinking': 'Thinking...',
  'app.modeBuild': 'Build',
  'app.modePlan': 'Plan',
  'app.attachFile': 'Attach file',
  'app.dropFiles': 'Drop files here',
  'app.dropFilesDesc': 'Add files for the AI to read',

  // Suggestions
  'suggest.trip': 'Plan a weekend trip',
  'suggest.email': 'Draft a professional email',
  'suggest.summarize': 'Summarize a long document',
  'suggest.research': 'Research a topic for me',
  'suggest.explain': 'Help me understand something',
  'suggest.brainstorm': 'Brainstorm creative ideas',

  // Welcome
  'welcome': "Hi! I'm Agent O. I can help you with coding, research, and tasks using multiple AI models. What would you like to do?",

  // Settings
  'settings.title': 'Settings',
  'settings.desc': 'Configure AI providers, models, and API keys',
  'settings.tab.models': 'General',
  'settings.tab.keys': 'API',
  'settings.tab.local': 'Local',
  'settings.tab.about': 'About',
  'settings.language': 'Language',
  'settings.autoFallback': 'Auto-fallback',
  'settings.autoFallbackDesc': 'Try other models if selected one fails',
  'settings.workspaceRoot': 'Workspace Root',
  'settings.workspaceRootDesc': 'Restrict file tools to this directory (empty = no restriction)',
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
  'settings.about.version': 'Agent O v0.1.0',
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

  // Sessions
  'session.chats': 'Chats',
  'session.new': 'New Chat',
  'session.noChats': 'No conversations yet',

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
  'local.step2desc': 'Running silent installer. This can take several minutes.',
  'local.step3desc': 'Downloading the {{model}} AI model ({{size}}). This is the largest step.',
  'local.installedModels': 'Installed Models',
  'local.installedModelsDesc': 'Models already pulled and ready to use. Click to switch.',
  'local.setActive': 'Set active',
  'local.active': 'Active',
  'local.recoveryTitle': 'Previous setup was interrupted',
  'local.recoveryDownloading': 'The installer download was interrupted. The partial file has been cleaned up.',
  'local.recoveryInstalling': 'Ollama installation was interrupted.',
  'local.recoveryPulling': 'The model download was interrupted.',
  'local.recoveryResume': 'Resume',
  'local.recoveryRestart': 'Restart Setup',
  'local.recoveryDismiss': 'Dismiss',
  'local.recoveryComplete': 'Looks like it actually completed!',
  'local.firstLaunchTitle': 'Run AI models locally?',
  'local.firstLaunchDesc': 'Download Llama 3.2 (2 GB) — a free, fast, local AI model. No internet needed after download.',
  'local.firstLaunchDownload': 'Download',
  'local.firstLaunchSkip': 'Skip',
  'local.addModel': 'Add Model',
  'local.addModelPlaceholder': 'e.g. llama3.2:3b',
  'local.addModelHint': 'Manually add a model name already pulled in Ollama.',
  'local.modelAdded': 'Added',

  // Tool events
  'tool.running': 'Running',
  'tool.completed': 'Completed',
  'tool.failed': 'Failed',
  'tool.input': 'Input',
  'tool.result': 'Result',

  // System prompt
  'system.prompt': `You are Agent O, an AI assistant running on Windows. You have access to tools: read_file, write_file, edit_file, list_files, bash, web_fetch, web_search, code_search, format_file, run_tests, read_memory, append_memory, read_daily, append_daily. Use them when needed. Be helpful, concise, and honest.`,
  'system.planPrefix': `You are in PLAN mode. Explain your approach step by step before executing any tools. Wait for the user to tell you to proceed before taking action.`,

  // Agent
  'agent.noModels': 'No AI models are available.',
  'agent.ollamaHint': 'Install Ollama from https://ollama.ai, run: ollama pull llama3.2, restart this app.',
  'agent.keyHint': 'Go to Settings > API Keys and add a key for Gemini or Groq.',
  'agent.fallback': 'Previously selected model "{{model}}" is not available. Falling back to **{{fallback}}**.',
  'agent.tryingOthers': 'Still trying other models...',
  'agent.trySwitch': 'Try switching to a different model or provider in Settings > Models.',
  'agent.routing': 'Routing to **{{task}}**: {{provider}}/{{model}}',
  'agent.providerNotFound': 'Provider "{{provider}}" not found. Check your Settings.',
  'agent.modelFailed': 'Model "{{model}}" is not available. Go to Settings > Models and pick a different model or enable Smart Routing.',
  'agent.noOutput': 'Model did not produce a response. Try using a different model.',
  'agent.error': 'Agent error: {{message}}',

  // Memory
  'memory.tab': 'Memory',
  'memory.context': 'Memory Context',
  'memory.contextDesc': 'Long-term memory loaded into every conversation',
  'memory.read': 'Read memory',
  'memory.append': 'Append to memory',

  // Evolution
  'evolution.title': 'Self-Evolution',
  'evolution.enabled': 'Enabled',
  'evolution.enabledDesc': 'Automatically review idle conversations to consolidate memory',
  'evolution.idleMinutes': 'Idle minutes',
  'evolution.idleMinutesDesc': 'How long a conversation must be idle before review',
  'evolution.minTurns': 'Minimum turns',
  'evolution.minTurnsDesc': 'Minimum user turns before review triggers',
  'evolution.capturing': 'Evolution capturing...',
  'evolution.completed': 'Evolution captured memory',

  // Providers
  'provider.ollama': 'Ollama',
  'provider.gemini': 'Google Gemini',
  'provider.groq': 'Groq',
  'provider.huggingface': 'Hugging Face',
  'provider.openrouter': 'OpenRouter',
}

const lv: Dict = {
  // App
  'app.title': 'Agent O',
  'app.settings': 'Iestatījumi',
  'app.hero.title': 'Kā es varu palīdzēt?',
  'app.hero.desc': 'Es varu rakstīt, pētīt, apkopot, ideju vētru un vēl — izmantojot labāko AI modeli katram uzdevumam.',
  'app.placeholder': 'Raksti ziņu...',
  'app.newChat': 'Jauna saruna',
  'app.messages': 'ziņas',
  'app.copy': 'Kopēt',
  'app.code': 'kods',
  'app.thinking': 'Domā...',
  'app.modeBuild': 'Build',
  'app.modePlan': 'Plāns',
  'app.attachFile': 'Pievienot failu',
  'app.dropFiles': 'Metiet failus šeit',
  'app.dropFilesDesc': 'Pievienojiet failus, lai AI tos varētu lasīt',

  // Suggestions
  'suggest.trip': 'Izplāno nedēļas nogales ceļojumu',
  'suggest.email': 'Uzraksti profesionālu e-pastu',
  'suggest.summarize': 'Apkopo garu dokumentu',
  'suggest.research': 'Izpēti man kādu tēmu',
  'suggest.explain': 'Palīdzi man kaut ko saprast',
  'suggest.brainstorm': 'Ideju vētras radošām idejām',

  // Welcome
  'welcome': 'Sveiks! Es esmu Agent O. Es varu palīdzēt ar programmēšanu, pētniecību un uzdevumiem, izmantojot vairākus AI modeļus. Ar ko vēlies sākt?',

  // Settings
  'settings.title': 'Iestatījumi',
  'settings.desc': 'Konfigurē AI nodrošinātājus, modeļus un API atslēgas',
  'settings.tab.models': 'Vispārīgi',
  'settings.tab.keys': 'API',
  'settings.tab.local': 'Lokāli',
  'settings.tab.about': 'Par',
  'settings.language': 'Valoda',
  'settings.autoFallback': 'Automātiska pārslēgšanās',
  'settings.autoFallbackDesc': 'Ja izvēlētais modelis nestrādā, izmēģina citus',
  'settings.workspaceRoot': 'Darba mape',
  'settings.workspaceRootDesc': 'Ierobežo failu rīkus uz šo mapi (tukšs = bez ierobežojuma)',
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
  'settings.about.version': 'Agent O v0.1.0',
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

  // Sessions
  'session.chats': 'Sarunas',
  'session.new': 'Jauna Saruna',
  'session.noChats': 'Vēl nav sarunu',

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
  'local.step2desc': 'Palaiž kluso instalētāju. Tas var aizņemt vairākas minūtes.',
  'local.step3desc': 'Lejupielādē {{model}} AI modeli ({{size}}). Šis ir lielākais solis.',
  'local.installedModels': 'Instalētie modeļi',
  'local.installedModelsDesc': 'Modeļi, kas jau ir lejupielādēti un gatavi lietošanai. Spied, lai aktivizētu.',
  'local.setActive': 'Aktivizēt',
  'local.active': 'Aktīvs',
  'local.recoveryTitle': 'Iepriekšējā iestatīšana tika pārtraukta',
  'local.recoveryDownloading': 'Instalētāja lejupielāde tika pārtraukta. Daļējais fails ir izdzēsts.',
  'local.recoveryInstalling': 'Ollama instalācija tika pārtraukta.',
  'local.recoveryPulling': 'Modeļa lejupielāde tika pārtraukta.',
  'local.recoveryResume': 'Turpināt',
  'local.recoveryRestart': 'Sākt no jauna',
  'local.recoveryDismiss': 'Nerādīt',
  'local.recoveryComplete': 'Izskatās, ka tas jau ir pabeigts!',
  'local.firstLaunchTitle': 'Palaist AI modeļus lokāli?',
  'local.firstLaunchDesc': 'Lejupielādē Llama 3.2 (2 GB) — bezmaksas, ātru, lokālu AI modeli. Pēc lejupielādes internets nav vajadzīgs.',
  'local.firstLaunchDownload': 'Lejupielādēt',
  'local.firstLaunchSkip': 'Izlaist',
  'local.addModel': 'Pievienot modeli',
  'local.addModelPlaceholder': 'piem. llama3.2:3b',
  'local.addModelHint': 'Manuāli pievieno modeli, kas jau ir lejupielādēts Ollama.',
  'local.modelAdded': 'Pievienots',

  // Tool events
  'tool.running': 'Izpilda',
  'tool.completed': 'Pabeigts',
  'tool.failed': 'Neizdevās',
  'tool.input': 'Ievade',
  'tool.result': 'Rezultāts',

  // System prompt
  'system.prompt': `Tu esi Agent O, AI asistents uz Windows. Tev ir piekļuve rīkiem: read_file, write_file, edit_file, list_files, bash, web_fetch, web_search, code_search, format_file, run_tests, read_memory, append_memory, read_daily, append_daily. Izmanto tos, kad vajag. Esi izpalīdzīgs, kodolīgs un godīgs. Atbildi tajā pašā valodā, kurā lietotājs raksta.`,
  'system.planPrefix': `Tu esi PLĀNA režīmā. Pirms jebkādu rīku izmantošanas, soli pa solim izskaidro savu pieeju. Nogaidi, kamēr lietotājs atļauj turpināt, pirms sāc darboties.`,

  // Agent
  'agent.noModels': 'Nav pieejami AI modeļi.',
  'agent.ollamaHint': 'Instalē Ollama no https://ollama.ai, palaid: ollama pull llama3.2, pārstartē šo lietotni.',
  'agent.keyHint': 'Dodies uz Iestatījumi > API Atslēgas un pievieno atslēgu priekš Gemini vai Groq.',
  'agent.fallback': 'Iepriekš izvēlētais modelis "{{model}}" nav pieejams. Pārslēdzos uz **{{fallback}}**.',
  'agent.tryingOthers': 'Joprojām mēģinu citus modeļus...',
  'agent.trySwitch': 'Pamēģini pārslēgties uz citu modeli vai nodrošinātāju Iestatījumi > Modeļi.',
  'agent.routing': 'Maršrutē uz **{{task}}**: {{provider}}/{{model}}',
  'agent.providerNotFound': 'Nodrošinātājs "{{provider}}" nav atrasts. Pārbaudi Iestatījumus.',
  'agent.modelFailed': 'Modelis "{{model}}" nav pieejams. Dodies uz Iestatījumi > Modeļi un izvēlies citu modeli vai ieslēdz Viedo maršrutēšanu.',
  'agent.noOutput': 'Modelis nesniedza atbildi. Pamēģini izmantot citu modeli.',
  'agent.error': 'Aģenta kļūda: {{message}}',

  // Memory
  'memory.tab': 'Atmiņa',
  'memory.context': 'Atmiņas konteksts',
  'memory.contextDesc': 'Ilgtermiņa atmiņa, kas tiek ielādēta katrā sarunā',
  'memory.read': 'Lasīt atmiņu',
  'memory.append': 'Pievienot atmiņai',

  // Evolution
  'evolution.title': 'Pašattīstība',
  'evolution.enabled': 'Ieslēgts',
  'evolution.enabledDesc': 'Automātiski pārskatīt tukšas sarunas, lai konsolidētu atmiņu',
  'evolution.idleMinutes': 'Tukšuma minūtes',
  'evolution.idleMinutesDesc': 'Cik ilgi sarunai jābūt tukšai pirms pārskatīšanas',
  'evolution.minTurns': 'Minimālās uzrunas',
  'evolution.minTurnsDesc': 'Minimālais lietotāja uzrunu skaits pirms pārskatīšanas',
  'evolution.capturing': 'Attīstība notiek...',
  'evolution.completed': 'Attīstība saglabāta atmiņā',

  // Providers
  'provider.ollama': 'Ollama',
  'provider.gemini': 'Google Gemini',
  'provider.groq': 'Groq',
  'provider.huggingface': 'Hugging Face',
  'provider.openrouter': 'OpenRouter',
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
