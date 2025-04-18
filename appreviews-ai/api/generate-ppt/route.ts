import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

export async function POST(req: Request): Promise<Response> {
  try {
    console.log('Starting PPT generation process...');
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    if (!existsSync(tempDir)) {
      console.log('Creating temp directory...');
      mkdirSync(tempDir, { recursive: true });
    }

    // Ensure scripts directory exists
    const scriptsDir = path.join(process.cwd(), 'scripts');
    if (!existsSync(scriptsDir)) {
      console.log('Creating scripts directory...');
      mkdirSync(scriptsDir, { recursive: true });
    }

    // Generate unique file names
    const timestamp = new Date().getTime();
    const inputFile = path.join(tempDir, `input_${timestamp}.json`);
    const outputFile = path.join(tempDir, `output_${timestamp}.pptx`);

    // Get and validate request data
    console.log('Validating request data...');
    const data = await req.json();
    if (!data || !data.title || !data.apps || !Array.isArray(data.apps)) {
      return NextResponse.json(
        { error: 'Invalid request data format' },
        { status: 400 }
      );
    }

    // Write input data to file
    console.log('Writing input data to file...');
    await fs.writeFile(inputFile, JSON.stringify(data, null, 2), 'utf-8');

    // Check if Python script exists
    const pythonScript = path.join(scriptsDir, 'generate_ppt.py');
    if (!existsSync(pythonScript)) {
      console.error('PPT generation script not found at:', pythonScript);
      return NextResponse.json(
        { error: 'PPT generation script not found' },
        { status: 500 }
      );
    }

    // Get Python path from environment variable or use default
    const pythonPath = process.env.PYTHON_PATH || 'py';
    console.log('Using Python path:', pythonPath);

    try {
      console.log('Executing Python script...');
      // Execute Python script
      const process = spawn(pythonPath, [
        pythonScript,
        '--input', inputFile,
        '--output', outputFile
      ]);

      // Handle process events
      return new Promise((resolve, reject) => {
        let errorOutput = '';
        let stdOutput = '';

        process.stderr.on('data', (data) => {
          errorOutput += data.toString();
          console.error('Python script error:', data.toString());
        });

        process.stdout.on('data', (data) => {
          stdOutput += data.toString();
          console.log('Python script output:', data.toString());
        });

        process.on('error', (error) => {
          console.error('Failed to start process:', error);
          reject(new Error(`Failed to start PPT generation: ${error.message}`));
        });

        process.on('close', async (code) => {
          console.log('Python process closed with code:', code);
          try {
            // Clean up input file
            await fs.unlink(inputFile);

            if (code !== 0) {
              console.error(`Process exited with code ${code}:`, errorOutput);
              reject(new Error(`PPT generation failed with code ${code}. Error: ${errorOutput}. Output: ${stdOutput}`));
              return;
            }

            // Check if output file exists
            if (!existsSync(outputFile)) {
              console.error('Output file not found at:', outputFile);
              reject(new Error('Output file was not generated'));
              return;
            }

            // Create a temporary URL for the file
            const fileUrl = `/temp/${path.basename(outputFile)}`;
            console.log('Generated file URL:', fileUrl);

            // Return success response with file URL and absolute path
            resolve(NextResponse.json({
              success: true,
              message: '成功生成 PPT',
              url: fileUrl,
              absolutePath: outputFile,
              filename: `競品分析報告_${new Date().toISOString().split('T')[0]}.pptx`
            }));

            // Schedule file cleanup after 5 minutes
            setTimeout(async () => {
              try {
                if (existsSync(outputFile)) {
                  await fs.unlink(outputFile);
                  console.log('Temporary file cleaned up:', outputFile);
                }
              } catch (error) {
                console.error('Error cleaning up temporary file:', error);
              }
            }, 5 * 60 * 1000);
          } catch (error) {
            console.error('Error in process close handler:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      // Clean up files in case of error
      try {
        if (existsSync(inputFile)) await fs.unlink(inputFile);
        if (existsSync(outputFile)) await fs.unlink(outputFile);
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in PPT generation:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate PPT',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 