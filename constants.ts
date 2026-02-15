
export const VOLUME_RANGES: { label: string; value: [number, number | null] }[] = [
    { label: 'Under 1k', value: [0, 1000] },
    { label: '1k - 5k', value: [1000, 5000] },
    { label: '5k - 6k', value: [5000, 6000] },
    { label: '6k - 7k', value: [6000, 7000] },
    { label: '7k - 8k', value: [7000, 8000] },
    { label: '8k - 10k', value: [8000, 10000] },
    { label: '10k - 15k', value: [10000, 15000] },
    { label: '15k - 20k', value: [15000, 20000] },
    { label: '20k - 25k', value: [20000, 25000] },
    { label: '25k - 30k', value: [25000, 30000] },
    { label: '30k - 40k', value: [30000, 40000] },
    { label: '40k - 50k', value: [40000, 50000] },
    { label: '50k - 100k', value: [50000, 100000] },
    { label: '100k+', value: [100000, null] },
];

export const SESSION_KEY = 'pindata_session';
export const SAVED_KEYWORDS_KEY = 'pindata_saved_keywords';
