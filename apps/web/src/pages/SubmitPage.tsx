import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';
import { primarySchoolTags, type SalaryBasis, type SalaryPeriod } from '@guess-salary/shared';
import { api, getCities, getMajors, type CitySuggestion, type MajorSuggestion } from '../api';
import { StatusBanner } from '../components/StatusBanner';

interface Captcha {
  token: string;
  question: string;
}
interface School {
  id: number;
  name: string;
  tags: string[];
}
type SchoolScope = 'MAINLAND' | 'OVERSEAS';

const initialForm = {
  degree: '本科',
  schoolNameRaw: '',
  major: '',
  tenureText: '',
  city: '',
  companyName: '',
  position: '',
  salaryAmount: 15000,
  salaryPeriod: 'MONTHLY' as SalaryPeriod,
  salaryBasis: 'PRETAX' as SalaryBasis,
  salaryIsIntern: false,
  authorNote: '',
  privacyConfirmed: false,
  captchaAnswer: '',
  website: '',
};

function salaryDisplayAmount(amount: number, period: SalaryPeriod) {
  return period === 'ANNUAL' ? (amount / 10_000).toFixed(1) : String(amount);
}

function salaryAmountStep(period: SalaryPeriod) {
  return period === 'ANNUAL' ? 0.1 : 100;
}

function normalizeSalaryAmount(value: string, period: SalaryPeriod) {
  const range =
    period === 'MONTHLY' ? { min: 1_000, max: 300_000 } : { min: 12_000, max: 8_000_000 };
  const parsed = Number(value);
  const amountInYuan = Number.isFinite(parsed)
    ? period === 'ANNUAL'
      ? parsed * 10_000
      : parsed
    : 0;
  const step = salaryAmountStep(period) * (period === 'ANNUAL' ? 10_000 : 1);
  const rounded = Math.round(amountInYuan / step) * step;
  return Math.max(range.min, Math.min(range.max, Math.round(rounded)));
}

export function SubmitPage() {
  const [form, setForm] = useState(initialForm);
  const [salaryAmountInput, setSalaryAmountInput] = useState(
    salaryDisplayAmount(initialForm.salaryAmount, initialForm.salaryPeriod),
  );
  const [schoolScope, setSchoolScope] = useState<SchoolScope>('MAINLAND');
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [schoolError, setSchoolError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [majors, setMajors] = useState<MajorSuggestion[]>([]);
  const [cities, setCities] = useState<CitySuggestion[]>([]);
  const [selectedMajorName, setSelectedMajorName] = useState<string | null>(null);
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);

  const loadCaptcha = async () => setCaptcha(await api<Captcha>('/api/captcha'));
  useEffect(() => {
    let active = true;
    void api<Captcha>('/api/captcha').then((value) => {
      if (active) setCaptcha(value);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (schoolScope === 'OVERSEAS' || selectedSchoolId !== null) {
      setSchools([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      if (form.schoolNameRaw.trim().length < 1) return setSchools([]);
      try {
        const response = await api<{ items: School[] }>(
          `/api/schools?query=${encodeURIComponent(form.schoolNameRaw)}`,
        );
        setSchools(response.items);
      } catch {
        setSchools([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [form.schoolNameRaw, schoolScope, selectedSchoolId]);

  useEffect(() => {
    if (selectedMajorName === form.major) {
      setMajors([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      if (form.major.trim().length < 1) return setMajors([]);
      try {
        const response = await getMajors(form.major, form.degree);
        setMajors(response.items);
      } catch {
        setMajors([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [form.degree, form.major, selectedMajorName]);

  useEffect(() => {
    if (selectedCityName === form.city) {
      setCities([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      if (form.city.trim().length < 1) return setCities([]);
      try {
        const response = await getCities(form.city);
        setCities(response.items);
      } catch {
        setCities([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [form.city, selectedCityName]);

  const update = (key: keyof typeof form, value: string | number | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!captcha) return;
    if (schoolScope === 'MAINLAND' && selectedSchoolId === null) {
      setSchoolError('请从联想列表中选择一所国内高校。');
      return;
    }
    setSchoolError(null);
    const committedSalaryAmount = normalizeSalaryAmount(salaryAmountInput, form.salaryPeriod);
    setForm((current) => ({ ...current, salaryAmount: committedSalaryAmount }));
    setSalaryAmountInput(salaryDisplayAmount(committedSalaryAmount, form.salaryPeriod));
    setStatus('loading');
    setError(null);
    try {
      await api('/api/submissions', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          salaryAmount: committedSalaryAmount,
          captchaAnswer: Number(form.captchaAnswer),
          captchaToken: captcha.token,
        }),
      });
      setStatus('success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '投稿失败，请重试。');
      setStatus('idle');
      void loadCaptcha();
    }
  };

  if (status === 'success') {
    return (
      <section className="success-state">
        <CheckCircle2 size={42} aria-hidden="true" />
        <p className="eyebrow">投稿已收到</p>
        <h1>谢谢你补上这份真实样本</h1>
        <p>内容会先经过脱敏和口径审核，通过后才进入题库。</p>
        <button
          className="btn-primary"
          type="button"
          onClick={() => {
            setForm(initialForm);
            setSalaryAmountInput(
              salaryDisplayAmount(initialForm.salaryAmount, initialForm.salaryPeriod),
            );
            setSchoolScope('MAINLAND');
            setSelectedSchoolId(null);
            setSchoolError(null);
            setMajors([]);
            setCities([]);
            setSelectedMajorName(null);
            setSelectedCityName(null);
            setStatus('idle');
            void loadCaptcha();
          }}
        >
          再投一份 <ArrowRight size={18} />
        </button>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-7 grid gap-5 md:grid-cols-[1fr_320px] md:items-end">
        <div>
          <p className="eyebrow">匿名投稿</p>
          <h1 className="page-title">把你的真实经历留给后来人</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
            只投稿自己的或已公开的信息。公司名可以写“某大厂”，不要填写姓名、联系方式或工号。
          </p>
        </div>
        <div className="privacy-callout">
          <ShieldCheck size={22} />
          <span>
            通过前人工审核
            <br />
            <small>不会直接公开</small>
          </span>
        </div>
      </div>

      <form className="form-surface" onSubmit={submit}>
        <fieldset>
          <legend>人物背景</legend>
          <div className="form-grid">
            <div className="school-scope md:col-span-2">
              <span className="field-label" id="school-scope-label">
                学校地区
              </span>
              <div
                className="segmented-control"
                role="radiogroup"
                aria-labelledby="school-scope-label"
              >
                {[
                  ['MAINLAND', '国内高校'],
                  ['OVERSEAS', '海外高校'],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="school-scope"
                      value={value}
                      checked={schoolScope === value}
                      onChange={() => {
                        setSchoolScope(value as SchoolScope);
                        setForm((current) => ({ ...current, schoolNameRaw: '' }));
                        setSelectedSchoolId(null);
                        setSchoolError(null);
                        setSchools([]);
                      }}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <label>
              <span>学历</span>
              <select value={form.degree} onChange={(e) => update('degree', e.target.value)}>
                {['专科', '本科', '硕士', '博士'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="relative">
              <span>学校</span>
              <input
                required
                value={form.schoolNameRaw}
                onChange={(e) => {
                  update('schoolNameRaw', e.target.value);
                  setSelectedSchoolId(null);
                  setSchoolError(null);
                }}
                autoComplete={schoolScope === 'MAINLAND' ? 'off' : 'organization'}
                placeholder={schoolScope === 'MAINLAND' ? '搜索学校' : '填写海外高校全称'}
                aria-invalid={schoolError ? 'true' : undefined}
                aria-describedby={schoolError ? 'school-name-error' : undefined}
              />
              {schoolScope === 'MAINLAND' && schools.length > 0 && (
                <div className="autocomplete" role="listbox">
                  {schools.map((school) => (
                    <button
                      key={school.id}
                      type="button"
                      onClick={() => {
                        update('schoolNameRaw', school.name);
                        setSelectedSchoolId(school.id);
                        setSchoolError(null);
                        setSchools([]);
                      }}
                    >
                      <strong>{school.name}</strong>
                      <small>{primarySchoolTags(school.tags).join(' · ')}</small>
                    </button>
                  ))}
                </div>
              )}
              {schoolError && (
                <small className="field-error" id="school-name-error" role="alert">
                  {schoolError}
                </small>
              )}
            </label>
            <label className="relative">
              <span>专业</span>
              <input
                required
                value={form.major}
                onChange={(e) => {
                  update('major', e.target.value);
                  setSelectedMajorName(null);
                  if (!e.target.value.trim()) setMajors([]);
                }}
                autoComplete="off"
                placeholder="搜索或直接填写专业"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={majors.length > 0}
                aria-controls="major-suggestions"
              />
              {majors.length > 0 && (
                <div className="autocomplete" id="major-suggestions" role="listbox">
                  {majors.map((major) => (
                    <button
                      key={major.id}
                      type="button"
                      role="option"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        update('major', major.name);
                        setSelectedMajorName(major.name);
                        setMajors([]);
                      }}
                    >
                      <strong>{major.name}</strong>
                      <small>
                        {major.category}
                        {major.code ? ` · ${major.code}` : ''}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </label>
            <label>
              <span>毕业已经</span>
              <input
                required
                value={form.tenureText}
                onChange={(e) => update('tenureText', e.target.value)}
                placeholder="如：2年、刚毕业、一年半"
              />
            </label>
            <label className="relative">
              <span>城市</span>
              <input
                required
                value={form.city}
                onChange={(e) => {
                  update('city', e.target.value);
                  setSelectedCityName(null);
                  if (!e.target.value.trim()) setCities([]);
                }}
                autoComplete="address-level2"
                placeholder="搜索或直接填写城市"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={cities.length > 0}
                aria-controls="city-suggestions"
              />
              {cities.length > 0 && (
                <div className="autocomplete" id="city-suggestions" role="listbox">
                  {cities.map((city) => (
                    <button
                      key={city.id}
                      type="button"
                      role="option"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        update('city', city.name);
                        setSelectedCityName(city.name);
                        setCities([]);
                      }}
                    >
                      <strong>{city.name}</strong>
                      <small>{city.province}</small>
                    </button>
                  ))}
                </div>
              )}
            </label>
            <label>
              <span>公司名称</span>
              <input
                required
                value={form.companyName}
                onChange={(e) => update('companyName', e.target.value)}
                placeholder="可写某大厂、某研究所"
              />
            </label>
            <label className="md:col-span-2">
              <span>岗位</span>
              <input
                required
                value={form.position}
                onChange={(e) => update('position', e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>薪资口径</legend>
          <div className="form-grid">
            <label>
              <span>周期</span>
              <select
                value={form.salaryPeriod}
                onChange={(e) => {
                  const nextPeriod = e.target.value as SalaryPeriod;
                  const currentAmount = normalizeSalaryAmount(salaryAmountInput, form.salaryPeriod);
                  const committedAmount = normalizeSalaryAmount(
                    salaryDisplayAmount(currentAmount, nextPeriod),
                    nextPeriod,
                  );
                  update('salaryPeriod', nextPeriod);
                  update('salaryAmount', committedAmount);
                  setSalaryAmountInput(salaryDisplayAmount(committedAmount, nextPeriod));
                }}
              >
                <option value="MONTHLY">月薪</option>
                <option value="ANNUAL">年薪</option>
              </select>
            </label>
            <label>
              <span>税前 / 税后</span>
              <select
                value={form.salaryBasis}
                onChange={(e) => update('salaryBasis', e.target.value)}
              >
                <option value="PRETAX">税前</option>
                <option value="AFTERTAX">税后 / 到手</option>
              </select>
            </label>
            <label className="md:col-span-2">
              <span>金额（{form.salaryPeriod === 'ANNUAL' ? '万元' : '元'}）</span>
              <input
                required
                type="number"
                inputMode={form.salaryPeriod === 'ANNUAL' ? 'decimal' : 'numeric'}
                min={form.salaryPeriod === 'MONTHLY' ? 1000 : 1.2}
                max={form.salaryPeriod === 'MONTHLY' ? 300000 : 800}
                step={salaryAmountStep(form.salaryPeriod)}
                value={salaryAmountInput}
                onChange={(e) => setSalaryAmountInput(e.target.value)}
                onBlur={() => {
                  const committedAmount = normalizeSalaryAmount(
                    salaryAmountInput,
                    form.salaryPeriod,
                  );
                  update('salaryAmount', committedAmount);
                  setSalaryAmountInput(salaryDisplayAmount(committedAmount, form.salaryPeriod));
                }}
              />
            </label>
            <label className="check-row md:col-span-2">
              <input
                type="checkbox"
                checked={form.salaryIsIntern}
                onChange={(e) => update('salaryIsIntern', e.target.checked)}
              />
              <span>这是实习期薪资</span>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>想说的话</legend>
          <label>
            <span className="sr-only">想说的话</span>
            <textarea
              required
              rows={5}
              maxLength={500}
              value={form.authorNote}
              onChange={(e) => update('authorNote', e.target.value)}
              placeholder="给同专业、同岗位或正在找工作的朋友留一句话"
            />
          </label>
          <p className="mt-2 text-right text-xs text-muted">{form.authorNote.length} / 500</p>
        </fieldset>

        <fieldset>
          <legend>确认与验证</legend>
          <label className="check-row">
            <input
              required
              type="checkbox"
              checked={form.privacyConfirmed}
              onChange={(e) => update('privacyConfirmed', e.target.checked)}
            />
            <span>我确认这是自己的或已公开的信息，且没有包含可识别个人身份的内容。</span>
          </label>
          <label className="mt-5 block max-w-xs">
            <span>{captcha?.question ?? '正在生成验证题'}</span>
            <input
              required
              type="number"
              inputMode="numeric"
              value={form.captchaAnswer}
              onChange={(e) => update('captchaAnswer', e.target.value)}
            />
          </label>
          <label className="hidden" aria-hidden="true">
            网站
            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => update('website', e.target.value)}
            />
          </label>
        </fieldset>

        {error && <StatusBanner tone="error">{error}</StatusBanner>}
        <button
          className="btn-primary w-full sm:w-auto"
          type="submit"
          disabled={status === 'loading'}
        >
          {status === 'loading' ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : (
            <ArrowRight size={18} />
          )}
          {status === 'loading' ? '正在提交' : '提交审核'}
        </button>
      </form>
    </div>
  );
}
