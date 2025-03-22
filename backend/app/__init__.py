from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import logging
import os
from config.config import Config
from app.models.models import db
from app.api.routes import api
from app.routes.cat12_routes import cat12_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # 配置日志
    logging.basicConfig(
        level=app.config['LOG_LEVEL'],
        format=app.config['LOG_FORMAT'],
        handlers=[
            logging.FileHandler(os.path.join(app.config['LOG_FOLDER'], app.config['LOG_FILE'])),
            logging.StreamHandler()
        ]
    )
    
    # 确保必要的目录存在
    for directory in [app.config['UPLOAD_FOLDER'], 
                     app.config['PROCESSED_FOLDER'],
                     app.config['REPORTS_FOLDER'],
                     app.config['LOG_FOLDER']]:
        if not os.path.exists(directory):
            os.makedirs(directory)
    
    # 初始化扩展
    CORS(app, resources={
        r"/*": {
            "origins": app.config['CORS_ORIGINS'],
            "methods": app.config['CORS_METHODS'],
            "allowed_headers": app.config['CORS_HEADERS']
        }
    })
    
    db.init_app(app)
    
    # 注册蓝图
    app.register_blueprint(api, url_prefix='/api')
    app.register_blueprint(cat12_bp, url_prefix='/api/cat12')
    
    # 创建数据库表
    with app.app_context():
        db.create_all()
    
    return app 