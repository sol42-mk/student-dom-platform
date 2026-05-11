"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Home() {
  const { publicKey } = useWallet();

  const [form, setForm] = useState({
    // Матријална состојба
    mesecenPriход: "",
    brojClenovi: "",
    brojStudenti: "",
    // Академски успех
    prosecnaOcenka: "",
    godinaStudii: "",
    odalecenost: "",
    // Посебни категории
    pocinalEdenRoditel: false,
    pocinaleDvajcaRoditeli: false,
    liceSoPoprecеnost: false,
    dvajcaNeraboteni: false,
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const target = e.target as HTMLInputElement;
    const value = target.type === "checkbox" ? target.checked : target.value;
    setForm((prev) => ({ ...prev, [target.name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("Форма:", form);
    alert("Формата е поднесена! (демо)");
  }

  return (
    <main
      style={{
        maxWidth: 600,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22 }}>Пријава за Студентски Дом</h1>
        <WalletMultiButton />
      </div>

      {publicKey && (
        <p style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>
          Поврзан: {publicKey.toBase58()}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 24 }}
      >
        {/* Матријална состојба */}
        <section>
          <h2
            style={{
              fontSize: 16,
              borderBottom: "1px solid #ddd",
              paddingBottom: 8,
            }}
          >
            Матријална состојба
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>
              <span style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
                1. Вкупен месечен приход на семејство (денари)
              </span>
              <input
                type="number"
                name="mesecenPriход"
                value={form.mesecenPriход}
                onChange={handleChange}
                placeholder="пр. 25000"
                style={inputStyle}
              />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
                2. Број на членови на семејство
              </span>
              <input
                type="number"
                name="brojClenovi"
                value={form.brojClenovi}
                onChange={handleChange}
                placeholder="пр. 4"
                style={inputStyle}
              />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
                3. Број на студенти во семејството (без кандидатот)
              </span>
              <input
                type="number"
                name="brojStudenti"
                value={form.brojStudenti}
                onChange={handleChange}
                placeholder="пр. 1"
                style={inputStyle}
              />
            </label>
          </div>
        </section>

        {/* Академски успех */}
        <section>
          <h2
            style={{
              fontSize: 16,
              borderBottom: "1px solid #ddd",
              paddingBottom: 8,
            }}
          >
            Академски успех
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>
              <span style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
                Просечна оценка од претходни години
              </span>
              <input
                type="number"
                step="0.01"
                min="6"
                max="10"
                name="prosecnaOcenka"
                value={form.prosecnaOcenka}
                onChange={handleChange}
                placeholder="пр. 8.50"
                style={inputStyle}
              />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
                Година на студии
              </span>
              <select
                name="godinaStudii"
                value={form.godinaStudii}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">— изберете —</option>
                <option value="1">1-ва година</option>
                <option value="2">2-ра година</option>
                <option value="3">3-та година</option>
                <option value="4">4-та година</option>
                <option value="5">5-та година</option>
              </select>
            </label>
            <label>
              <span style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
                Оддалеченост од градот на студентскиот дом (км)
              </span>
              <input
                type="number"
                name="odalecenost"
                value={form.odalecenost}
                onChange={handleChange}
                placeholder="пр. 120"
                style={inputStyle}
              />
            </label>
          </div>
        </section>

        {/* Посебни категории */}
        <section>
          <h2
            style={{
              fontSize: 16,
              borderBottom: "1px solid #ddd",
              paddingBottom: 8,
            }}
          >
            Посебни категории
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { name: "pocinalEdenRoditel", label: "Починат еден родител" },
              {
                name: "pocinaleDvajcaRoditeli",
                label: "Починати двајца родители",
              },
              {
                name: "liceSoPoprecеnost",
                label: "Кандидатот е лице со попреченост",
              },
              {
                name: "dvajcaNeraboteni",
                label: "Двајца родители невработени",
              },
            ].map(({ name, label }) => (
              <label
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  name={name}
                  checked={form[name as keyof typeof form] as boolean}
                  onChange={handleChange}
                  style={{ width: 18, height: 18 }}
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        <button
          type="submit"
          style={{
            padding: "12px 24px",
            background: "#512da8",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Поднеси пријава
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 14,
  boxSizing: "border-box",
};
