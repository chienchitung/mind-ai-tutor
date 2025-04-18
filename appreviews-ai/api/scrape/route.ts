import { NextResponse } from 'next/server';
import axios from 'axios';
import type { ApiResponse } from '@/types/feedback';

// 使用類型斷言確保環境變數存在
const API_URL = process.env.SCRAPER_API_URL!;
const API_KEY = process.env.SCRAPER_API_KEY!;

export async function POST(request: Request) {
    try {
        // 檢查環境變數
        console.log('Checking environment variables...');
        console.log('API_URL:', process.env.SCRAPER_API_URL ? 'set' : 'not set');
        console.log('API_KEY:', process.env.SCRAPER_API_KEY ? 'set' : 'not set');

        // 提前驗證環境變數
        if (!process.env.SCRAPER_API_URL || !process.env.SCRAPER_API_KEY) {
            console.error('Missing environment variables:', { 
                API_URL: process.env.SCRAPER_API_URL || 'missing',
                API_KEY: process.env.SCRAPER_API_KEY ? 'present' : 'missing'
            });
            throw new Error('Missing API configuration');
        }

        const { appleStore, googlePlay } = await request.json();
        
        console.log('Making request to:', process.env.SCRAPER_API_URL);
        console.log('Request data:', { appleStore, googlePlay });

        // 使用驗證過的環境變數
        const response = await axios.post<ApiResponse>(
            process.env.SCRAPER_API_URL,
            { appleStore, googlePlay },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.SCRAPER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 60000,
                validateStatus: (status) => status < 500
            }
        );

        console.log('Response received:', {
            status: response.status,
            statusText: response.statusText,
            data: response.data
        });

        if (response.status === 404) {
            return NextResponse.json({
                success: false,
                error: 'API endpoint not found',
                details: 'Please check the API URL configuration'
            }, { status: 404 });
        }

        return NextResponse.json(response.data);
        
    } catch (error) {
        console.error('Request failed:', error);
        
        if (axios.isAxiosError(error)) {
            const errorDetails = {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                url: error.config?.url,
                method: error.config?.method,
                headers: error.config?.headers
            };
            console.error('Axios error details:', errorDetails);
            
            return NextResponse.json({
                success: false,
                error: 'API Request Failed',
                details: errorDetails
            }, { status: error.response?.status || 500 });
        }

        return NextResponse.json({
            success: false,
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
} 