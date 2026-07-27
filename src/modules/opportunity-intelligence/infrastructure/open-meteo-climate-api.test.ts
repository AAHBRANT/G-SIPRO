import { describe, expect, it, vi } from "vitest";

import { OpenMeteoClimateApi } from "./open-meteo-climate-api";

const context = {
  locationLabel: "São Paulo/SP",
  latitude: -23.55,
  longitude: -46.63,
  workStart: "2026-01-01",
  workEnd: "2026-12-31",
};

function dailyResponse(days: readonly { date: string; precipitation: number | null; temperature: number | null }[]) {
  return new Response(JSON.stringify({
    daily: {
      time: days.map((day) => day.date),
      precipitation_sum: days.map((day) => day.precipitation),
      temperature_2m_mean: days.map((day) => day.temperature),
    },
  }), { status: 200 });
}

describe("OpenMeteoClimateApi", () => {
  it("consulta a Open-Meteo sem exigir token e sem expor segredo nenhum", async () => {
    const fetcher = vi.fn().mockResolvedValue(dailyResponse([
      { date: "2024-01-15", precipitation: 10, temperature: 25 },
      { date: "2025-01-15", precipitation: 20, temperature: 27 },
    ]));
    await new OpenMeteoClimateApi(
      { baseUrl: "https://archive-api.open-meteo.com/v1/archive", historyYears: 20, timeoutMs: 5_000 },
      fetcher,
    ).collectHistoricalMonthly(context);

    const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("daily")).toBe("precipitation_sum,temperature_2m_mean");
    expect(init.headers).not.toHaveProperty("authorization");
  });

  it("calcula a média mensal de precipitação e temperatura entre os anos disponíveis", async () => {
    const fetcher = vi.fn().mockResolvedValue(dailyResponse([
      { date: "2024-01-10", precipitation: 100, temperature: 24 },
      { date: "2024-01-20", precipitation: 50, temperature: 26 },
      { date: "2025-01-10", precipitation: 90, temperature: 28 },
    ]));
    const result = await new OpenMeteoClimateApi(
      { baseUrl: "https://archive-api.open-meteo.com/v1/archive", historyYears: 20, timeoutMs: 5_000 },
      fetcher,
    ).collectHistoricalMonthly(context);

    const january = result.monthly.find((item) => item.month === 1);
    expect(january?.sampleYears).toBe(2);
    // total 2024 = 150mm, total 2025 = 90mm -> média = 120mm
    expect(january?.precipitationMm).toBe(120);
    // média das 3 leituras de temperatura: (24+26+28)/3 = 26
    expect(january?.averageTemperatureC).toBe(26);
    expect(result.provider).toContain("Open-Meteo");
  });

  it("ignora dias com valor nulo em vez de tratá-los como zero", async () => {
    const fetcher = vi.fn().mockResolvedValue(dailyResponse([
      { date: "2024-03-01", precipitation: null, temperature: null },
      { date: "2024-03-02", precipitation: 30, temperature: 22 },
    ]));
    const result = await new OpenMeteoClimateApi(
      { baseUrl: "https://archive-api.open-meteo.com/v1/archive", historyYears: 20, timeoutMs: 5_000 },
      fetcher,
    ).collectHistoricalMonthly(context);

    const march = result.monthly.find((item) => item.month === 3);
    expect(march?.precipitationMm).toBe(30);
    expect(march?.completeness).toBe(50);
  });

  it("não inclui mês sem nenhum dado no resultado", async () => {
    const fetcher = vi.fn().mockResolvedValue(dailyResponse([
      { date: "2024-01-10", precipitation: 10, temperature: 25 },
    ]));
    const result = await new OpenMeteoClimateApi(
      { baseUrl: "https://archive-api.open-meteo.com/v1/archive", historyYears: 20, timeoutMs: 5_000 },
      fetcher,
    ).collectHistoricalMonthly(context);

    expect(result.monthly.map((item) => item.month)).toEqual([1]);
  });

  it("tenta de novo quando a conexão falha antes de desistir", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(dailyResponse([
        { date: "2024-01-10", precipitation: 10, temperature: 25 },
      ]));
    const result = await new OpenMeteoClimateApi(
      { baseUrl: "https://archive-api.open-meteo.com/v1/archive", historyYears: 20, timeoutMs: 5_000 },
      fetcher,
    ).collectHistoricalMonthly(context);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.monthly.map((item) => item.month)).toEqual([1]);
  });

  it("desiste depois de esgotar as tentativas de reconexão", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(new OpenMeteoClimateApi(
      { baseUrl: "https://archive-api.open-meteo.com/v1/archive", historyYears: 20, timeoutMs: 5_000 },
      fetcher,
    ).collectHistoricalMonthly(context)).rejects.toThrow("Não foi possível obter os dados da Open-Meteo.");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
