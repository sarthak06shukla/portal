export interface Report {
    id: number;
    company: string;
    date: string;
    open_price: number;
    high_price: number;
    low_price: number;
    close_price: number;
    volume: number;
    title?: string;
    type?: string;
    fiscal_year?: string;
    quarter?: string;
    content?: string;
} 