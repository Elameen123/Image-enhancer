// pages/index.js
import Head from 'next/head';
import ImageProcessor from '../components/ImageProcessor';

export default function Home() {
  return (
    <div>
      <Head>
        <title>Image Brightness & Contrast Enhancer</title>
        <meta name="description" content="Enhance image brightness and contrast" />
        <link rel="icon" href="../public/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
      </Head>

      <main>
        <ImageProcessor />
      </main>
    </div>
  );
}