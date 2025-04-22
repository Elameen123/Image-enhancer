import { useState, useEffect, useRef, useCallback } from 'react';
import Chart from 'chart.js/auto';
import Image from 'next/image';
import styles from '../styles/ImageProcessor.module.css';

// Client-side Histogram Component
function Histogram({ imageData, title, className }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  
  // Calculate histogram data from image data
  const calculateHistogram = (imgData) => {
    const histR = Array(256).fill(0);
    const histG = Array(256).fill(0);
    const histB = Array(256).fill(0);
    
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      histR[data[i]]++;      // Red
      histG[data[i + 1]]++;  // Green
      histB[data[i + 2]]++;  // Blue
    }
    
    return { r: histR, g: histG, b: histB };
  };

  useEffect(() => {
    if (!imageData || !canvasRef.current) return;
    
    // Clean up previous chart if it exists
    if (chartRef.current) {
      chartRef.current.destroy();
    }
    
    // Create histograms for RGB channels
    const histograms = calculateHistogram(imageData);
    
    // Create chart
    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array.from({ length: 256 }, (_, i) => i),
        datasets: [
          {
            label: 'Red',
            data: histograms.r,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderWidth: 1,
            pointRadius: 0
          },
          {
            label: 'Green',
            data: histograms.g,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderWidth: 1,
            pointRadius: 0
          },
          {
            label: 'Blue',
            data: histograms.b,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderWidth: 1,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        animation: false,
        plugins: {
          title: {
            display: true,
            text: title
          },
          legend: {
            position: 'top',
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Pixel Value'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Frequency'
            },
            beginAtZero: true
          }
        }
      }
    });
  }, [imageData, title]);

  return <canvas ref={canvasRef} className={className} />;
}

export default function ImageProcessor() {
  const [originalImage, setOriginalImage] = useState(null);
  const [adjustedImage, setAdjustedImage] = useState(null);
  const [originalHistogram, setOriginalHistogram] = useState(null);
  const [adjustedHistogram, setAdjustedHistogram] = useState(null);
  const [useClientHistograms, setUseClientHistograms] = useState(true);
  const [alpha, setAlpha] = useState(1.0);
  const [beta, setBeta] = useState(0);
  const [loading, setLoading] = useState(false);

  const [imageData, setImageData] = useState(null);
  const [adjustedImageData, setAdjustedImageData] = useState(null);
  const canvasRef = useRef(null);
  const adjustedCanvasRef = useRef(null);
  const timeoutRef = useRef(null);
  const [imgWidth, setImgWidth] = useState(300);
  const [imgHeight, setImgHeight] = useState(200);
  
  // Get the backend URL from environment variable
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  
  // Debug the backend URL
  useEffect(() => {
    console.log("Backend URL:", backendURL);
  }, [backendURL]);

  // Define applyAdjustments with useCallback to avoid dependency issues
  const applyAdjustments = useCallback((imgData, a, b) => {
    if (!adjustedCanvasRef.current) return;
    
    const ctx = adjustedCanvasRef.current.getContext('2d');
    adjustedCanvasRef.current.width = imgData.width;
    adjustedCanvasRef.current.height = imgData.height;
    
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(a * d[i] + b, 0, 255);
      d[i+1] = clamp(a * d[i+1] + b, 0, 255);
      d[i+2] = clamp(a * d[i+2] + b, 0, 255);
    }
    
    ctx.putImageData(imgData, 0, 0);
    setAdjustedImageData(imgData);
    setAdjustedImage(adjustedCanvasRef.current.toDataURL('image/png'));
  }, []);

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  // Define adjustImageFromServer with useCallback
  const adjustImageFromServer = useCallback(async () => {
    if (!originalImage) return;
    try {
      const res = await fetch(`${backendURL}/api/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alpha, beta }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log("Adjust response:", data);
      
      // Update the adjusted histogram (and image if needed)
      if (!useClientHistograms && data.adjusted_histogram) {
        setAdjustedHistogram(`data:image/png;base64,${data.adjusted_histogram}`);
      }
    } catch (error) {
      console.error('Adjustment request failed:', error);
    }
  }, [originalImage, alpha, beta, backendURL, useClientHistograms]);

  useEffect(() => {
    if (originalImage && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        setImgWidth(img.width);
        setImgHeight(img.height);
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setImageData(imgData);
        applyAdjustments(imgData, alpha, beta);
      };
      img.src = originalImage;
    }
  }, [originalImage, alpha, beta, applyAdjustments]);

  useEffect(() => {
    if (imageData && canvasRef.current) {
      const clone = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );
      applyAdjustments(clone, alpha, beta);
      
      // If we're using server-side histograms, debounce the API call
      if (!useClientHistograms) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => adjustImageFromServer(), 500);
      }
    }
  }, [alpha, beta, imageData, useClientHistograms, applyAdjustments, adjustImageFromServer]);

  const handleImageUpload = async (e) => {
    if (!e.target.files.length) return;
    setLoading(true);
    const file = e.target.files[0];
    const fd = new FormData();
    fd.append('image', file);
    
    try {
      console.log(`Sending request to ${backendURL}/api/upload`);
      const res = await fetch(`${backendURL}/api/upload`, { 
        method: 'POST', 
        body: fd 
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log("Upload response:", data);
      
      // Create an actual image object to verify the data is valid
      const img = new Image();
      img.onload = () => {
        setImgWidth(img.width);
        setImgHeight(img.height);
        setOriginalImage(`data:image/png;base64,${data.original_image}`);
        
        // If not using client-side histograms, set the server-generated one
        if (!useClientHistograms && data.original_histogram) {
          setOriginalHistogram(`data:image/png;base64,${data.original_histogram}`);
        }
        
        // If using server-side histograms, get the adjusted histogram as well
        if (!useClientHistograms) {
          adjustImageFromServer();
        }
      };
      
      img.onerror = () => {
        console.error("Failed to load image data");
        alert("Failed to process the image. Invalid image data received from server.");
        setLoading(false);
      };
      
      img.src = `data:image/png;base64,${data.original_image}`;
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearImage = async () => {
    setOriginalImage(null);
    setAdjustedImage(null);
    setOriginalHistogram(null);
    setAdjustedHistogram(null);
    setImageData(null);
    setAdjustedImageData(null);
    setAlpha(1.0);
    setBeta(0);
    
    try {
      await fetch(`${backendURL}/api/clear`, { method: 'POST' });
    } catch (error) {
      console.error('Clear request failed:', error);
    }
  };

  const toggleHistogramMode = () => {
    setUseClientHistograms(!useClientHistograms);
    // If switching to server histograms, fetch them immediately
    if (useClientHistograms && originalImage) {
      adjustImageFromServer();
    }
  };

  // Custom image component that handles base64 images for dynamic content
  const SafeImage = ({ src, alt, className }) => {
    if (!src) return null;
    
    // For base64 images, we need to use regular img tags
    // Next.js Image component doesn't work well with base64 content
    return (
      <div className={className}>
        {/* We're keeping the regular img tag here because Next.js Image doesn't support 
            dynamic base64 strings well (would require a custom loader) */}
        <img 
          src={src}
          alt={alt}
          className={styles.regularImage}
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        />
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.appHeader}>
        <h1 className={styles.title}>LuminoTune: Image Enhancer</h1>
        <button 
          onClick={toggleHistogramMode} 
          className={styles.toggleButton}
        >
          {useClientHistograms ? 'Use Server Histograms' : 'Use Client Histograms'}
        </button>
      </header>

      <div className={styles.mainLayout}>
        {/* LEFT PANEL */}
        <div className={styles.leftPanel}>
          {/* Images Container - Side by Side */}
          <div className={styles.imagesContainer}>
            <section className={styles.originalImageBox}>
              <div className={styles.imageHeader}>
                <span className={styles.imageTitle}>Original Image</span>
                <div className={styles.imageControls}>
                  <label htmlFor="upload-image" className={styles.addButton}>+</label>
                  <input id="upload-image" type="file" accept="image/*" onChange={handleImageUpload} hidden />
                  <button className={styles.clearButton} onClick={clearImage}>×</button>
                </div>
              </div>
              <div className={styles.imageContainer}>
                {loading ? (
                  <div className={styles.emptyState}>Loading...</div>
                ) : originalImage ? (
                  <SafeImage 
                    src={originalImage} 
                    className={styles.imageWrapper} 
                    alt="Original" 
                  />
                ) : (
                  <div className={styles.emptyState}>No image selected</div>
                )}
              </div>
            </section>

            <section className={styles.adjustedImageBox}>
              <div className={styles.imageHeader}>
                <span className={styles.imageTitle}>Adjusted Image</span>
              </div>
              <div className={styles.imageContainer}>
                {loading ? (
                  <div className={styles.emptyState}>Loading...</div>
                ) : adjustedImage ? (
                  <SafeImage 
                    src={adjustedImage} 
                    className={styles.imageWrapper} 
                    alt="Adjusted" 
                  />
                ) : (
                  <div className={styles.emptyState}>No processed image</div>
                )}
              </div>
            </section>
          </div>

          {/* Controls Section - Below Both Images */}
          <aside className={styles.controlsSection}>
            <div className={styles.sliderContainer}>
              <label className={styles.sliderLabel}>Alpha (Contrast): {alpha.toFixed(1)}</label>
              <div className={styles.sliderRow}>
                <input
                  type="range" min="0.1" max="3.0" step="0.1"
                  value={alpha} onChange={e => setAlpha(parseFloat(e.target.value))}
                  className={styles.slider}
                />
                <input
                  type="number" min="0.1" max="3.0" step="0.1"
                  value={alpha} onChange={e => setAlpha(parseFloat(e.target.value))}
                  className={styles.valueInput}
                />
              </div>
            </div>
            <div className={styles.sliderContainer}>
              <label className={styles.sliderLabel}>Beta (Brightness): {beta}</label>
              <div className={styles.sliderRow}>
                <input
                  type="range" min="-100" max="100" step="1"
                  value={beta} onChange={e => setBeta(parseInt(e.target.value))}
                  className={styles.slider}
                />
                <input
                  type="number" min="-100" max="100" step="1"
                  value={beta} onChange={e => setBeta(parseInt(e.target.value))}
                  className={styles.valueInput}
                />
              </div>
            </div>
          </aside>
        </div>

        {/* RIGHT PANEL */}
        <div className={styles.rightPanel}>
          <section className={styles.histogramBox}>
            <div className={styles.histogramHeader}>
              <span className={styles.histogramTitle}>Original Histogram</span>
            </div>
            <div className={styles.histogramImage}>
              {useClientHistograms ? (
                imageData ? (
                  <Histogram 
                    imageData={imageData} 
                    title="Original Histogram" 
                    className={styles.histogram} 
                  />
                ) : (
                  <div className={styles.emptyState}>No histogram</div>
                )
              ) : (
                originalHistogram ? (
                  <SafeImage 
                    src={originalHistogram} 
                    className={styles.histogramWrapper} 
                    alt="Original Histogram" 
                  />
                ) : (
                  <div className={styles.emptyState}>No histogram</div>
                )
              )}
            </div>
          </section>

          <section className={styles.histogramBox}>
            <div className={styles.histogramHeader}>
              <span className={styles.histogramTitle}>
                Adjusted Histogram (α: {alpha.toFixed(1)}, β: {beta})
              </span>
            </div>
            <div className={styles.histogramImage}>
              {useClientHistograms ? (
                adjustedImageData ? (
                  <Histogram 
                    imageData={adjustedImageData} 
                    title={`Adjusted Histogram (α: ${alpha.toFixed(1)}, β: ${beta})`} 
                    className={styles.histogram} 
                  />
                ) : (
                  <div className={styles.emptyState}>No histogram</div>
                )
              ) : (
                adjustedHistogram ? (
                  <SafeImage 
                    src={adjustedHistogram} 
                    className={styles.histogramWrapper} 
                    alt="Adjusted Histogram" 
                  />
                ) : (
                  <div className={styles.emptyState}>No histogram</div>
                )
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Hidden canvases for image processing */}
      <canvas ref={canvasRef} hidden />
      <canvas ref={adjustedCanvasRef} hidden />
    </div>
  );
}