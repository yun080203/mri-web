import os
from backend.app import create_app
from backend.app.models.models import db

def init_database():
    app = create_app()
    with app.app_context():
        # 创建数据库表
        db.create_all()
        print("数据库表已创建")
        
        # 创建必要的目录
        directories = [
            app.config['UPLOAD_FOLDER'],
            app.config['PROCESSED_FOLDER'],
            app.config['REPORTS_FOLDER'],
            app.config['LOG_FOLDER']
        ]
        
        for directory in directories:
            if not os.path.exists(directory):
                os.makedirs(directory)
                print(f"创建目录: {directory}")
            else:
                print(f"目录已存在: {directory}")

if __name__ == '__main__':
    init_database() 