const os = require('node:os');
const { spawn } = require('node:child_process');

const SAMPLE_INTERVAL_MS = 1000;

// Reads optional hardware sources that Windows does not expose to normal apps:
// MSI Afterburner (MAHM) and RivaTuner (RTSS) shared memory provide temperatures
// and frame rate; LibreHardwareMonitor WMI and GPU performance counters are fallbacks.
const SAMPLER_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -ReferencedAssemblies System.Core -TypeDefinition @'
using System;
using System.Text;
using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;
public static class GamesWidgetSensors {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  static double? Valid(float value) { return (float.IsNaN(value) || value < 0 || value > 1000000) ? (double?)null : value; }
  public static object[] Afterburner() {
    try {
      using (var map = MemoryMappedFile.OpenExisting("MAHMSharedMemory", MemoryMappedFileRights.Read))
      using (var view = map.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read)) {
        if (view.ReadUInt32(0) != 0x4D41484D) return null;
        uint headerSize = view.ReadUInt32(8), count = view.ReadUInt32(12), entrySize = view.ReadUInt32(16);
        double? cpuTemp = null, fps = null, frameTime = null;
        var gpuTemp = new double?[16]; var gpuLoad = new double?[16];
        var name = new byte[260];
        for (uint i = 0; i < count && i < 512; i++) {
          long offset = headerSize + (long)i * entrySize;
          double? value = Valid(view.ReadSingle(offset + 1300));
          uint gpu = view.ReadUInt32(offset + 1316), source = view.ReadUInt32(offset + 1320);
          if (source == 0x00 && gpu < 16) gpuTemp[gpu] = value;
          else if (source == 0x30 && gpu < 16) gpuLoad[gpu] = value;
          else if (source == 0x50) fps = value;
          else if (source == 0x51) frameTime = value;
          else if (source == 0x80) {
            view.ReadArray(offset, name, 0, 260);
            string label = Encoding.ASCII.GetString(name).Split('\0')[0];
            if (label == "CPU temperature" || cpuTemp == null) cpuTemp = value;
          }
        }
        int best = -1;
        for (int g = 0; g < 16; g++) {
          if (gpuTemp[g] == null && gpuLoad[g] == null) continue;
          if (best < 0 || (gpuLoad[g] ?? 0) > (gpuLoad[best] ?? 0)) best = g;
        }
        return new object[] { cpuTemp, best >= 0 ? gpuTemp[best] : null, best >= 0 ? gpuLoad[best] : null, fps, frameTime };
      }
    } catch { return null; }
  }
  public static double[] Rtss() {
    try {
      using (var map = MemoryMappedFile.OpenExisting("RTSSSharedMemoryV2", MemoryMappedFileRights.Read))
      using (var view = map.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read)) {
        uint signature = view.ReadUInt32(0);
        // Accept both 0x53535452 (RTSS) and 0x52545353 (RTSR - different version)
        if (signature != 0x53535452 && signature != 0x52545353) return null;
        uint entrySize = view.ReadUInt32(8), arrayOffset = view.ReadUInt32(12), arraySize = view.ReadUInt32(16);
        uint foreground; GetWindowThreadProcessId(GetForegroundWindow(), out foreground);
        double[] latest = null; uint latestTime = 0;
        for (uint i = 0; i < arraySize && i < 256; i++) {
          long offset = arrayOffset + (long)i * entrySize;
          uint processId = view.ReadUInt32(offset);
          if (processId == 0) continue;
          uint time0 = view.ReadUInt32(offset + 268), time1 = view.ReadUInt32(offset + 272);
          uint frames = view.ReadUInt32(offset + 276), frameTime = view.ReadUInt32(offset + 280);
          // Don't check absolute time - RTSS uses different time source than TickCount
          // Just check that time is increasing and frames > 0
          if (time1 <= time0 || frames == 0) continue;
          var sample = new double[] { 1000.0 * frames / (time1 - time0), frameTime / 1000.0 };
          if (processId == foreground) return sample;
          if (time1 > latestTime) { latestTime = time1; latest = sample; }
        }
        return latest;
      }
    } catch { return null; }
  }
}
'@

function Get-LhmTemperatures {
  foreach ($namespace in 'root/LibreHardwareMonitor', 'root/OpenHardwareMonitor') {
    $sensors = @(Get-CimInstance -Namespace $namespace -ClassName Sensor -Filter "SensorType='Temperature'")
    if (-not $sensors.Count) { continue }
    $cpu = $sensors | Where-Object { $_.Identifier -match '/(amd|intel)cpu/' } | Sort-Object { if ($_.Name -match 'Tctl|Tdie|Package') { 0 } else { 1 } }, { -$_.Value } | Select-Object -First 1
    $gpu = $sensors | Where-Object { $_.Identifier -match '/gpu' } | Sort-Object { if ($_.Name -match 'Core') { 0 } else { 1 } } | Select-Object -First 1
    return @($cpu.Value, $gpu.Value)
  }
  return @($null, $null)
}

$checkLhmAt = 0
$lhm = @($null, $null)
while ($true) {
  $started = [Environment]::TickCount
  $sample = [ordered]@{ cpuTemp = $null; gpuTemp = $null; gpuLoad = $null; fps = $null; frameTime = $null; sources = @() }
  $afterburner = [GamesWidgetSensors]::Afterburner()
  if ($afterburner) {
    $sample.cpuTemp = $afterburner[0]; $sample.gpuTemp = $afterburner[1]; $sample.gpuLoad = $afterburner[2]
    $sample.fps = $afterburner[3]; $sample.frameTime = $afterburner[4]
    $sample.sources += 'MSI Afterburner'
  }
  if ($null -eq $sample.fps) {
    $rtss = [GamesWidgetSensors]::Rtss()
    if ($rtss) { $sample.fps = $rtss[0]; $sample.frameTime = $rtss[1]; $sample.sources += 'RivaTuner' }
  }
  if ($null -eq $sample.cpuTemp -or $null -eq $sample.gpuTemp) {
    if ($started -ge $checkLhmAt -or $null -ne $lhm[0] -or $null -ne $lhm[1]) {
      $lhm = Get-LhmTemperatures
      if ($null -eq $lhm[0] -and $null -eq $lhm[1]) { $checkLhmAt = $started + 15000 }
    }
    if ($null -eq $sample.cpuTemp -and $null -ne $lhm[0]) { $sample.cpuTemp = $lhm[0]; $sample.sources += 'LibreHardwareMonitor' }
    if ($null -eq $sample.gpuTemp -and $null -ne $lhm[1]) { $sample.gpuTemp = $lhm[1]; $sample.sources += 'LibreHardwareMonitor' }
  }
  if ($null -eq $sample.gpuLoad) {
    $counter = Get-Counter '\GPU Engine(*engtype_3D)\Utilization Percentage' -MaxSamples 1
    if ($counter) { $sample.gpuLoad = [Math]::Min(100, ($counter.CounterSamples | Measure-Object CookedValue -Sum).Sum) }
  }
  [Console]::Out.WriteLine(($sample | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
  $remaining = 1000 - ([Environment]::TickCount - $started)
  if ($remaining -gt 0) { Start-Sleep -Milliseconds $remaining }
}
`;

function readCpuTimes() {
  return os.cpus().reduce((total, cpu) => {
    const { idle, ...busy } = cpu.times;
    total.idle += idle;
    total.all += idle + Object.values(busy).reduce((sum, value) => sum + value, 0);
    return total;
  }, { idle: 0, all: 0 });
}

function roundOrNull(value, digits = 0) {
  const number = Number(value);
  if (value === null || value === undefined || !Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function createPerformanceMonitor(onSample) {
  let timer = null;
  let sampler = null;
  let samplerBuffer = '';
  let lastCpu = null;
  let hardware = {};

  function startSampler() {
    if (process.platform !== 'win32' || sampler) return;
    const encoded = Buffer.from(SAMPLER_SCRIPT, 'utf16le').toString('base64');
    sampler = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    sampler.stdout.setEncoding('utf8');
    sampler.stdout.on('data', (chunk) => {
      samplerBuffer += chunk;
      const lines = samplerBuffer.split(/\r?\n/);
      samplerBuffer = lines.pop();
      for (const line of lines) {
        try { hardware = JSON.parse(line); } catch { /* Ignore partial PowerShell output. */ }
      }
    });
    const current = sampler;
    sampler.on('error', (error) => console.warn('Performance sampler failed:', error.message));
    sampler.on('exit', () => {
      if (sampler === current) { sampler = null; hardware = {}; }
    });
  }

  function emit() {
    const cpu = readCpuTimes();
    const cpuLoad = lastCpu && cpu.all > lastCpu.all ? 100 * (1 - (cpu.idle - lastCpu.idle) / (cpu.all - lastCpu.all)) : null;
    lastCpu = cpu;
    const ramTotal = os.totalmem();
    const ramUsed = ramTotal - os.freemem();
    onSample({
      cpuLoad: roundOrNull(cpuLoad),
      cpuTemp: roundOrNull(hardware.cpuTemp),
      gpuLoad: roundOrNull(hardware.gpuLoad),
      gpuTemp: roundOrNull(hardware.gpuTemp),
      fps: roundOrNull(hardware.fps),
      frameTime: roundOrNull(hardware.frameTime, 1),
      ramUsedGb: roundOrNull(ramUsed / 1024 ** 3, 1),
      ramTotalGb: roundOrNull(ramTotal / 1024 ** 3, 1),
      ramLoad: roundOrNull(100 * ramUsed / ramTotal),
      sources: [...new Set(Array.isArray(hardware.sources) ? hardware.sources : hardware.sources ? [hardware.sources] : [])]
    });
  }

  return {
    start() {
      if (timer) return;
      lastCpu = readCpuTimes();
      startSampler();
      timer = setInterval(emit, SAMPLE_INTERVAL_MS);
      setTimeout(emit, 250);
    },
    stop() {
      clearInterval(timer);
      timer = null;
      if (sampler) {
        const running = sampler;
        sampler = null;
        hardware = {};
        running.kill();
      }
    },
    get running() { return Boolean(timer); }
  };
}

module.exports = { createPerformanceMonitor, SAMPLER_SCRIPT };
