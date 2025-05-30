'use client';

import { useState } from 'react';
import styles from './page.module.css';

interface ApiFeedbackResponse {
  transcript?: string;
  scores: Record<string, number | string>;
  overallFeedback: string;
  observation: string;
}

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ApiFeedbackResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false); // For drag-over visual feedback

  // Helper function to process the file from input or drag/drop
  const processFile = (file: File) => {
    // Basic client-side type check
    if (file.type !== "audio/mpeg" && file.type !== "audio/wav" && !file.name.endsWith(".mp3") && !file.name.endsWith(".wav")) {
        setError("Invalid file type. Please use an MP3 or WAV file.");
        setSelectedFile(null);
        if (audioSrc) {
            URL.revokeObjectURL(audioSrc);
            setAudioSrc(null);
        }
        return;
    }

    setSelectedFile(file);
    if (audioSrc) {
      URL.revokeObjectURL(audioSrc);
    }
    const objectUrl = URL.createObjectURL(file);
    setAudioSrc(objectUrl);
    setError(null);
    setFeedback(null);
  };

  // Handles file selection from the browse button
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      processFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
      if (audioSrc) {
        URL.revokeObjectURL(audioSrc);
      }
      setAudioSrc(null);
    }
  };

  const handleProcessClick = async () => {
    if (!selectedFile) {
      setError("Please select an audio file first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setFeedback(null);

    const formData = new FormData();
    formData.append('audioFile', selectedFile);

    try {
       const response = await fetch('/api/analyze-call', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      // Inside if (!response.ok) { ... } block in handleProcessClick
try {
    const errorData = await response.json();
    if (typeof errorData === 'object' && errorData !== null) {
        const message = (errorData as Record<string, unknown>)['message'];
        const errorProp = (errorData as Record<string, unknown>)['error'];
        if (typeof message === 'string') {
            errorMessage = message;
        } else if (typeof errorProp === 'string') {
            errorMessage = errorProp;
        }
    }
} catch { // Removed _e as it's not used
    // Intentionally ignoring JSON parsing error for the error response body
}

    const data: ApiFeedbackResponse = await response.json();
    setFeedback(data);

  } catch (err) { // Removed ': any'
    let detailedErrorMessage = "An unexpected error occurred. Please try again.";
    if (err instanceof Error) {
        detailedErrorMessage = err.message;
    } else if (typeof err === 'string') { // Handle if the error thrown was just a string
        detailedErrorMessage = err;
    }
    // Log the original error object (err) as it might contain more info than just the message
    console.error("Failed to process audio catch block:", err);
    setError(detailedErrorMessage);
  } finally {
    setIsLoading(false);
  }
  };

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>AI Call Feedback Analyzer</h1>

      {/* Section for File Upload with Drag & Drop */}
      <section className={styles.section}>
        <h2>Upload Audio File (.mp3, .wav)</h2>
        <div
          className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (isLoading) return; 

            if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
              processFile(event.dataTransfer.files[0]);
              event.dataTransfer.clearData();
            }
          }}
        >
          <input
            type="file"
            accept=".mp3,.wav"
            onChange={handleFileChange}
            className={styles.fileInput} 
            disabled={isLoading}
            id="fileInput"
          />
          <label htmlFor="fileInput" className={styles.dropZoneLabel}>
            {isDragging ? "Release to drop file" : "Drag & drop an MP3/WAV file here, or click to select"}
          </label>
        </div>

        {selectedFile && <p className={styles.selectedFileName}>Selected file: {selectedFile.name}</p>}
        <button
          onClick={handleProcessClick}
          disabled={isLoading || !selectedFile}
          className={styles.processButton}
        >
          {isLoading ? 'Processing...' : 'Process Audio'}
        </button>
      </section>

      {/* Section for Audio Player */}
      <section className={styles.section}>
        <h2>Audio Player</h2>
        {audioSrc ? (
          <audio controls src={audioSrc} className={styles.audioPlayer}>
            Your browser does not support the audio element.
          </audio>
        ) : (
          <p>Select an audio file to play.</p>
        )}
      </section>

      {/* Section for Displaying Feedback (Consolidated) */}
      <section className={styles.section}>
        <h2>Feedback Results</h2>

        {error && <p className={styles.errorMessage}>Error: {error}</p>}
        {isLoading && <p>Loading feedback...</p>}

        {!isLoading && !error && feedback && (
          <>
            {feedback.transcript && (
              <div className={styles.feedbackSectionItem}>
                <h3>Transcript:</h3>
                <p className={styles.feedbackText} style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
                  {feedback.transcript}
                </p>
              </div>
            )}
            <div className={styles.feedbackSectionItem}>
              <h3>Scores:</h3>
              <pre className={styles.jsonOutput}>
                {JSON.stringify(feedback.scores, null, 2)}
              </pre>
            </div>
            <div className={styles.feedbackSectionItem}>
              <h3>Overall Feedback:</h3>
              <p className={styles.feedbackText}>{feedback.overallFeedback}</p>
            </div>
            <div className={styles.feedbackSectionItem}>
              <h3>Observation:</h3>
              <p className={styles.feedbackText}>{feedback.observation}</p>
            </div>
          </>
        )}

        {!isLoading && !error && !feedback && (
          <p>Submit an audio file to see feedback.</p>
        )}
      </section>
    </main>
  );
}