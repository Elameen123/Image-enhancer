from http.server import BaseHTTPRequestHandler
import json
import base64
import cv2
import numpy as np
import cgi
import io

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Parse the form data
        content_type = self.headers.get('Content-Type', '')
        if not content_type.startswith('multipart/form-data'):
            self.send_error(400, "Expected multipart/form-data")
            return
        
        # Parse the multipart form data
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={'REQUEST_METHOD': 'POST'}
        )
        
        # Get the file data
        file_item = form['file']
        if not file_item or not file_item.file:
            self.send_error(400, "No file provided")
            return
        
        # Get alpha and beta values
        try:
            alpha = float(form.getvalue('alpha', '1.0'))
            beta = int(form.getvalue('beta', '0'))
        except ValueError:
            self.send_error(400, "Invalid alpha or beta value")
            return
        
        # Read the file data
        file_data = file_item.file.read()
        
        # Convert to OpenCV format
        try:
            nparr = np.frombuffer(file_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if image is None:
                raise ValueError("Could not decode image")
        except Exception as e:
            self.send_error(400, f"Error reading image: {str(e)}")
            return
        
        # Process the image
        try:
            # Apply brightness and contrast adjustment
            adjusted_image = self.adjust_brightness_contrast(image, alpha, beta)
            
            # Calculate histograms
            original_histogram = self.calculate_histogram(image)
            adjusted_histogram = self.calculate_histogram(adjusted_image)
            
            # Convert images to base64
            original_base64 = self.encode_image_to_base64(image)
            adjusted_base64 = self.encode_image_to_base64(adjusted_image)
            
            # Prepare the response
            response_data = {
                "original_image": original_base64,
                "adjusted_image": adjusted_base64,
                "original_histogram": original_histogram,
                "adjusted_histogram": adjusted_histogram
            }
            
            # Send the response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())
            
        except Exception as e:
            self.send_error(500, f"Error processing image: {str(e)}")
    
    def adjust_brightness_contrast(self, image, alpha, beta):
        """Apply brightness and contrast adjustment to an image."""
        adjusted = cv2.convertScaleAbs(image, alpha=alpha, beta=beta)
        return adjusted
    
    def calculate_histogram(self, image):
        """Calculate histogram for each color channel."""
        histograms = {}
        for i, color in enumerate(['blue', 'green', 'red']):
            hist = cv2.calcHist([image], [i], None, [256], [0, 255])
            histograms[color] = hist.flatten().tolist()
        return histograms
    
    def encode_image_to_base64(self, image):
        """Convert OpenCV image to base64 string."""
        _, buffer = cv2.imencode('.png', image)
        return base64.b64encode(buffer).decode('utf-8')
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()