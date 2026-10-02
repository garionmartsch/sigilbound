export declare enum ImpactStyle { Heavy = 'HEAVY', Medium = 'MEDIUM', Light = 'LIGHT' }
export declare const Haptics: {
  impact(o: { style: ImpactStyle }): Promise<void>;
  vibrate(o?: { duration?: number }): Promise<void>;
};
