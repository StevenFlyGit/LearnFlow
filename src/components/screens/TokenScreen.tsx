'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Settings, Eye, EyeOff, CheckCircle2, Loader2, User, Key, Globe } from 'lucide-react';
import { useStore } from '@/lib/store';
import { putConfig, type TokenConfig } from '@/lib/db';
import { toast } from 'sonner';
import { cn } from '@/utils/utils';

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI Chat Completions 格式', defaultModel: 'gpt-4o-mini', placeholder: 'https://api.openai.com/v1' },
  { id: 'anthropic', label: 'Anthropic Messages 格式', defaultModel: 'claude-3-5-sonnet-20241022', placeholder: 'https://api.anthropic.com/v1' },
] as const;

function MaskedInput({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('w-full pr-10', className)} />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9E988F] hover:text-[#6E6A64]">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

const INPUT_CLASS = 'w-full px-3 py-2.5 rounded-lg border border-[#EFEAE0] bg-[#F3EEE6] text-sm text-[#2C2A29] placeholder:text-[#9E988F] focus:outline-none focus:ring-2 focus:ring-[#8FA67F]/40 transition-all';

export function TokenScreen() {
  const { config, setConfig } = useStore();
  const router = useRouter();
  const [form, setForm] = useState<Omit<TokenConfig, 'id'>>({
    aiProvider: 'openai', apiKey: '', modelName: 'gpt-4o-mini', baseUrl: '',
    openaiApiKey: '', openaiModelName: 'gpt-4o-mini', openaiBaseUrl: '',
    anthropicApiKey: '', anthropicModelName: 'claude-3-5-sonnet-20241022', anthropicBaseUrl: '',
    notionToken: '', notionDatabaseId: '', userName: '', userAvatar: '',
    globalDailyHours: undefined, learningPreferences: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [prevConfig, setPrevConfig] = useState<TokenConfig | null>(null);
  if (config && config !== prevConfig) {
    setPrevConfig(config);
    
    // Automatically migrate and initialize format-specific fields
    const openaiApiKey = config.openaiApiKey || (config.aiProvider === 'openai' ? config.apiKey : '');
    const openaiModelName = config.openaiModelName || (config.aiProvider === 'openai' ? config.modelName : 'gpt-4o-mini');
    const openaiBaseUrl = config.openaiBaseUrl || (config.aiProvider === 'openai' ? config.baseUrl : '');
    
    const anthropicApiKey = config.anthropicApiKey || (config.aiProvider === 'anthropic' ? config.apiKey : '');
    const anthropicModelName = config.anthropicModelName || (config.aiProvider === 'anthropic' ? config.modelName : 'claude-3-5-sonnet-20241022');
    const anthropicBaseUrl = config.anthropicBaseUrl || (config.aiProvider === 'anthropic' ? config.baseUrl : '');

    setForm({
      ...config,
      openaiApiKey,
      openaiModelName,
      openaiBaseUrl,
      anthropicApiKey,
      anthropicModelName,
      anthropicBaseUrl,
    });
  }

  const handleProviderChange = (id: 'openai' | 'deepseek' | 'anthropic') => {
    const p = PROVIDERS.find(x => x.id === id);
    if (!p) return;
    
    // Load format-specific configuration if present, otherwise use defaults
    let targetKey = '';
    let targetModel: string = p.defaultModel;
    let targetBaseUrl = '';
    
    if (id === 'openai') {
      targetKey = form.openaiApiKey || '';
      targetModel = form.openaiModelName || p.defaultModel;
      targetBaseUrl = form.openaiBaseUrl || '';
    } else if (id === 'anthropic') {
      targetKey = form.anthropicApiKey || '';
      targetModel = form.anthropicModelName || p.defaultModel;
      targetBaseUrl = form.anthropicBaseUrl || '';
    }
    
    setForm(f => ({
      ...f,
      aiProvider: id,
      apiKey: targetKey,
      modelName: targetModel,
      baseUrl: targetBaseUrl,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const c: TokenConfig = { id: 'config', ...form };
      await putConfig(c);
      
      // 检查是否修改了影响排期的配置
      const dailyHoursChanged = config?.globalDailyHours !== form.globalDailyHours;
      
      setConfig(c);
      setSaved(true);
      
      if (dailyHoursChanged) {
        toast.success('配置已保存');
        const shouldApply = confirm('配置已保存。检测到全局每日学习时间已变更，是否立即前往规划页重新排期？');
        if (shouldApply) {
          router.push('/planning');
        }
      } else {
        toast.success('配置已保存');
      }
      
      setTimeout(() => setSaved(false), 2500);
    } catch { toast.error('保存失败'); }
    finally { setSaving(false); }
  };

  const activePlaceholder = PROVIDERS.find(p => p.id === form.aiProvider)?.placeholder || '';

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#FAF7F2]">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-[#8FA67F]/15 flex items-center justify-center">
            <Settings size={18} className="text-[#8FA67F]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#2C2A29]" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>Token 配置</h1>
            <p className="text-xs text-[#9E988F] mt-0.5">所有配置仅保存在本地浏览器中，不会上传到服务器</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* AI Provider */}
          <div className="bg-[#F3EEE6] border border-[#EFEAE0] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#2C2A29] mb-4 flex items-center gap-2">
              <Key size={14} className="text-[#C8834A]" />AI 模型配置
            </h2>

            <div className="mb-4">
              <label className="text-xs font-medium text-[#6E6A64] mb-2 block">AI 接口协议</label>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.map(p => (
                  <button key={p.id} onClick={() => handleProviderChange(p.id)}
                    className={cn('py-2.5 px-3 rounded-lg text-xs font-medium border transition-all',
                      form.aiProvider === p.id
                        ? 'border-[#8FA67F] bg-[#8FA67F]/12 text-[#3E4D3E]'
                        : 'border-[#EFEAE0] text-[#9E988F] hover:border-[#D8D0C4]'
                    )}>
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#9E988F] mt-2">
                💡 提示：两种协议的配置是<b>独立存储</b>的。系统最终会采用当前<b>高亮选中并保存</b>的协议来进行大模型调用。
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#6E6A64] mb-1.5 block">API Key</label>
                <MaskedInput value={form.apiKey} onChange={v => setForm(f => {
                  const next = { ...f, apiKey: v };
                  if (f.aiProvider === 'openai') next.openaiApiKey = v;
                  if (f.aiProvider === 'anthropic') next.anthropicApiKey = v;
                  return next;
                })}
                  placeholder="sk-..." className={INPUT_CLASS} />
              </div>
              <div>
                <label className="text-xs font-medium text-[#6E6A64] mb-1.5 block">Model 名称</label>
                <input value={form.modelName} onChange={e => {
                  const val = e.target.value;
                  setForm(f => {
                    const next = { ...f, modelName: val };
                    if (f.aiProvider === 'openai') next.openaiModelName = val;
                    if (f.aiProvider === 'anthropic') next.anthropicModelName = val;
                    return next;
                  });
                }}
                  placeholder={PROVIDERS.find(p => p.id === form.aiProvider)?.defaultModel}
                  className={INPUT_CLASS} />
              </div>
              <div>
                <label className="text-xs font-medium text-[#6E6A64] mb-1.5 block">
                  自定义 Base URL <span className="text-[#9E988F] font-normal">（选填，默认使用官方地址）</span>
                </label>
                <div className="relative">
                  <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E988F]" />
                  <input value={form.baseUrl || ''} onChange={e => {
                    const val = e.target.value;
                    setForm(f => {
                      const next = { ...f, baseUrl: val };
                      if (f.aiProvider === 'openai') next.openaiBaseUrl = val;
                      if (f.aiProvider === 'anthropic') next.anthropicBaseUrl = val;
                      return next;
                    });
                  }}
                    placeholder={activePlaceholder}
                    className={cn(INPUT_CLASS, 'pl-8')} />
                </div>
              </div>
            </div>
          </div>

          {/* Notion */}
          <div className="bg-[#F3EEE6] border border-[#EFEAE0] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#2C2A29] mb-1 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#2C2A29]">
                <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
              </svg>
              Notion 集成
            </h2>
            <p className="text-[11px] text-[#9E988F] mb-4">
              前往 <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer"
                className="text-[#8FA67F] hover:underline">notion.so/my-integrations</a> 创建 Integration 并获取 Token
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#6E6A64] mb-1.5 block">Integration Token</label>
                <MaskedInput value={form.notionToken} onChange={v => setForm(f => ({ ...f, notionToken: v }))}
                  placeholder="secret_..." className={INPUT_CLASS} />
              </div>
              <div>
                <label className="text-xs font-medium text-[#6E6A64] mb-1.5 block">
                  Database ID <span className="text-[#9E988F] font-normal">（选填，留空则自动创建）</span>
                </label>
                <input value={form.notionDatabaseId || ''} onChange={e => setForm(f => ({ ...f, notionDatabaseId: e.target.value }))}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className={INPUT_CLASS} />
              </div>
            </div>
          </div>

          {/* System & Preferences */}
          <div className="bg-[#F3EEE6] border border-[#EFEAE0] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#2C2A29] mb-4 flex items-center gap-2">
              <User size={14} className="text-[#8FA67F]" />系统与偏好设置 (System & Preferences)
            </h2>
            
            <div className="space-y-4">
              {/* Profile Card */}
              <div>
                <h3 className="text-xs font-semibold text-[#6E6A64] mb-2">个人资料</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-[#9E988F] mb-1 block">显示名称</label>
                    <input value={form.userName || ''} onChange={e => setForm(f => ({ ...f, userName: e.target.value }))}
                      placeholder="学习者" className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#9E988F] mb-1 block">头像 URL</label>
                    <input value={form.userAvatar || ''} onChange={e => setForm(f => ({ ...f, userAvatar: e.target.value }))}
                      placeholder="https://..." className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#9E988F] mb-1 block">学习偏好备注 (未来扩展)</label>
                    <input value={form.learningPreferences || ''} onChange={e => setForm(f => ({ ...f, learningPreferences: e.target.value }))}
                      placeholder="例如：倾向清晨学习、数学偏好等" className={INPUT_CLASS} />
                  </div>
                </div>
              </div>

              {/* Learning Preferences */}
              <div className="border-t border-[#EFEAE0]/60 pt-3.5">
                <h3 className="text-xs font-semibold text-[#6E6A64] mb-2">学习偏好</h3>
                <div>
                  <label className="text-[11px] font-medium text-[#9E988F] mb-1 block">
                    全局每日学习时间上限 (小时)
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="24"
                    value={form.globalDailyHours ?? ''} 
                    onChange={e => {
                      const val = e.target.value;
                      setForm(f => ({ 
                        ...f, 
                        globalDailyHours: val === '' ? undefined : Math.min(24, Math.max(1, parseInt(val) || 1)) 
                      }));
                    }}
                    placeholder="不限制" 
                    className={INPUT_CLASS} 
                  />
                  <span className="text-[10px] text-[#9E988F] mt-1 block">
                    各领域总工时超标时将触发视觉警告标志
                  </span>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <motion.button
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
          onClick={handleSave} disabled={saving}
          className="w-full mt-5 py-3 rounded-xl bg-[#8FA67F] text-white font-medium hover:bg-[#5D7052] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Settings size={16} />}
          {saving ? '保存中...' : saved ? '已保存' : '保存配置'}
        </motion.button>
      </div>
    </div>
  );
}
