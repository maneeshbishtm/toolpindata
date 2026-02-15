
export interface KeywordData {
    id: string;
    name: string;
    volume: number;
    followers: number;
    hasRelatedInterests: boolean;
    category: string;
    breadcrumbs: string[];
    relatedInterests: string[];
    relatedSearches: string[];
}

export interface CategoryInfo {
    id: string;
    name: string;
    count: string;
}

export type SortField = 'name' | 'volume';
export type SortOrder = 'asc' | 'desc';
