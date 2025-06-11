import got from 'got';

// ----------------------------------
//  OBIS and Value Array Types
// ----------------------------------

type ObisCode = string;

type ObisValueArray = [
  number, number, number, number, number,
  number, number, number, number, number
];

// ----------------------------------
//  Device Info (from /deviceInfo)
// ----------------------------------

export interface DeviceInfo {
  mac_address: string;
  version: string;
  hw_revision: string;
  feat_external_antenna: boolean;
  feat_pass_through: boolean;
  feat_ethernet: boolean;
}

// ----------------------------------
//  New Meter Format (from /meterData)
// ----------------------------------

export interface MeterDataNewFormat {
  d: Record<ObisCode, ObisValueArray>;
  last_ok_interval: number;
  info: {
    ip: string;
    mac: string;
    uptime: number;
    mqtt_state: string;
    rssi: number;
    tx: number;
    wifi_conn_cnt: number;
    failCnt: number;
    okCnt: number;
    resetCnt: number;
    meter: string;
    mode: string;
  };
}

// ----------------------------------
//  Old Meter Format
// ----------------------------------

interface ObisValueWrapper {
  v: ObisValueArray;
}

interface OldMeterDataGroup {
  obis: Record<ObisCode, ObisValueWrapper>;
}

export interface MeterDataOldFormat {
  d: Record<string, OldMeterDataGroup>;
  info: {
    rssi: number;
  };
}

// ----------------------------------
//  Union Type
// ----------------------------------

type MeterData = MeterDataNewFormat | MeterDataOldFormat;

// ----------------------------------
//  Final Data Structure Returned
// ----------------------------------

export interface MeterReading {
  voltageL1: number;
  voltageL2: number;
  voltageL3: number;
  currentL1: number;
  currentL2: number;
  currentL3: number;
  powerL1: number;
  powerL2: number;
  powerL3: number;
  momentaryPowerImport: number;
  momentaryPowerExport: number;
  activeEnergyImport: number;
  activeEnergyExport: number;
  rssi: number;
}

// ----------------------------------
// ⚡ P1ibConnector Class
// ----------------------------------

export class P1ibConnector {
  address: string;

  constructor(address: string) {
    this.address = address;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    const url = `http://${this.address}/deviceInfo`;
    const response = await got(url);
    return JSON.parse(response.body) as DeviceInfo;
  }

  private getValueFromMeterData(meterData: MeterData, obis: string): number {
    const VALUE_INDEX = 9;

    // New format
    if (isNewMeterDataFormat(meterData)) {
      const values = meterData.d[obis];
      if (Array.isArray(values) && values.length > VALUE_INDEX) {
        return values[VALUE_INDEX];
      }
    }

    // Old format
    if (isOldMeterDataFormat(meterData)) {
      for (const group of Object.values(meterData.d)) {
        if (obis in group.obis) {
          const valueArray = group.obis[obis].v;
          if (Array.isArray(valueArray) && valueArray.length > VALUE_INDEX) {
            return valueArray[VALUE_INDEX];
          }
        }
      }
    }

    return 0;
  }

  async readMeterData(): Promise<MeterReading> {
    const url = `http://${this.address}/meterData`;
    const response = await got(url);
    const meterData = JSON.parse(response.body) as MeterData;

    const obisMap = {
      momentaryPowerImport: '1-0:1.7.0',
      momentaryPowerExport: '1-0:2.7.0',
      activeEnergyImport: '1-0:1.8.0',
      activeEnergyExport: '1-0:2.8.0',
      voltageL1: '1-0:32.7.0',
      voltageL2: '1-0:52.7.0',
      voltageL3: '1-0:72.7.0',
      currentL1: '1-0:31.7.0',
      currentL2: '1-0:51.7.0',
      currentL3: '1-0:71.7.0',
      powerImportL1: '1-0:21.7.0',
      powerImportL2: '1-0:41.7.0',
      powerImportL3: '1-0:61.7.0',
      powerExportL1: '1-0:22.7.0',
      powerExportL2: '1-0:42.7.0',
      powerExportL3: '1-0:62.7.0',
    };

    const momentaryPowerImport = this.getValueFromMeterData(meterData, obisMap.momentaryPowerImport) * 1000;
    const momentaryPowerExport = this.getValueFromMeterData(meterData, obisMap.momentaryPowerExport) * 1000;

    const activeEnergyImport = this.getValueFromMeterData(meterData, obisMap.activeEnergyImport);
    const activeEnergyExport = this.getValueFromMeterData(meterData, obisMap.activeEnergyExport);

    const currentL1 = this.getValueFromMeterData(meterData, obisMap.currentL1);
    const currentL2 = this.getValueFromMeterData(meterData, obisMap.currentL2);
    const currentL3 = this.getValueFromMeterData(meterData, obisMap.currentL3);

    const voltageL1 = this.getValueFromMeterData(meterData, obisMap.voltageL1);
    const voltageL2 = this.getValueFromMeterData(meterData, obisMap.voltageL2);
    const voltageL3 = this.getValueFromMeterData(meterData, obisMap.voltageL3);

    const powerImportL1 = this.getValueFromMeterData(meterData, obisMap.powerImportL1) * 1000;
    const powerImportL2 = this.getValueFromMeterData(meterData, obisMap.powerImportL2) * 1000;
    const powerImportL3 = this.getValueFromMeterData(meterData, obisMap.powerImportL3) * 1000;

    const powerExportL1 = this.getValueFromMeterData(meterData, obisMap.powerExportL1) * 1000;
    const powerExportL2 = this.getValueFromMeterData(meterData, obisMap.powerExportL2) * 1000;
    const powerExportL3 = this.getValueFromMeterData(meterData, obisMap.powerExportL3) * 1000;

    const powerL1 = powerImportL1 - powerExportL1;
    const powerL2 = powerImportL2 - powerExportL2;
    const powerL3 = powerImportL3 - powerExportL3;

    const rssi = meterData.info.rssi;

    return {
      voltageL1,
      voltageL2,
      voltageL3,
      currentL1,
      currentL2,
      currentL3,
      powerL1,
      powerL2,
      powerL3,
      momentaryPowerImport,
      momentaryPowerExport,
      activeEnergyImport,
      activeEnergyExport,
      rssi,
    };
  }
}

// ----------------------------------
//  Type Guards
// ----------------------------------

function isNewMeterDataFormat(data: any): data is MeterDataNewFormat {
  const values = Object.values(data?.d ?? {});
  const firstEntry = values[0] as any;

  return (
    typeof data?.info === 'object' &&
    typeof data?.last_ok_interval === 'number' &&
    typeof data?.d === 'object' &&
    (firstEntry && !('obis' in firstEntry))
  );
}

function isOldMeterDataFormat(data: unknown): data is MeterDataOldFormat {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('d' in data)
  ) {
    return false;
  }

  const d = (data as any).d;

  if (typeof d !== 'object' || d === null) return false;

  const firstGroup = Object.values(d)[0];

  return (
    typeof firstGroup === 'object' &&
    firstGroup !== null &&
    'obis' in firstGroup &&
    typeof (firstGroup as any).obis === 'object'
  );
};

export default P1ibConnector;
